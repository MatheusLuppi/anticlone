# src/routes/verify.py

import re
from flask import Blueprint, request, jsonify
from src.database import db
from src.models.user import User
from src.models.domain import Domain
from src.models.access_log import AccessLog
from src.routes.domain import normalize_domain # Reuse the normalization function

verify_bp = Blueprint("verify", __name__)

@verify_bp.route("/verify", methods=["GET"])
def verify_domain():
    client_id = request.args.get("client_id") # This is the User UUID
    visiting_domain_raw = request.args.get("domain") # The domain where the script is running
    user_agent = request.headers.get("User-Agent")
    ip_address = request.remote_addr
    referer = request.headers.get("Referer")

    if not client_id or not visiting_domain_raw:
        # Return a minimal response or even a 204 No Content to avoid giving info away
        # For now, let's return an error for clarity during development
        return jsonify({"status": "error", "message": "client_id and domain parameters are required"}), 400

    # 1. Validate client_id (User UUID)
    user = User.query.filter_by(uuid=client_id, is_active=True).first()
    if not user:
        # User not found or inactive, treat as unauthorized but don't give specifics
        # We can't log this against a specific user/domain according to current schema
        return jsonify({"status": "unauthorized", "action": "none"}), 200 # Return 200 OK but signal unauthorized

    # 2. Normalize the visiting domain
    visiting_domain_normalized = normalize_domain(visiting_domain_raw)
    if not visiting_domain_normalized:
         # Invalid domain format from request
         return jsonify({"status": "error", "message": "Invalid domain format"}), 400

    # 3. Check if the normalized domain is authorized AND active for this user
    authorized_domain = Domain.query.filter_by(
        user_id=user.id,
        domain_name=visiting_domain_normalized,
        is_active=True
    ).first()

    if authorized_domain:
        # Domain is authorized and active
        return jsonify({"status": "authorized"}), 200
    else:
        # Domain is NOT authorized or is inactive
        # Determine which action to take and which domain to log against.
        # Strategy: Find the first *active* domain for this user to get action settings and log ID.
        # If no active domains, default to 'none' action and don't log (or log differently? TBD).
        
        log_domain_id = None
        action_to_take = "none" # Default action
        action_target = None

        # Check if the domain matches an *inactive* domain for the user
        inactive_domain_match = Domain.query.filter_by(
            user_id=user.id,
            domain_name=visiting_domain_normalized,
            is_active=False
        ).first()

        if inactive_domain_match:
            # Log against the inactive domain and use its action
            log_domain_id = inactive_domain_match.id
            action_to_take = inactive_domain_match.action_if_cloned
            action_target = inactive_domain_match.action_target
        else:
            # If no exact match (active or inactive), find the first active domain for fallback action/logging
            first_active_domain = Domain.query.filter_by(user_id=user.id, is_active=True).first()
            if first_active_domain:
                log_domain_id = first_active_domain.id
                action_to_take = first_active_domain.action_if_cloned
                action_target = first_active_domain.action_target
            # If no active domains exist for the user, log_domain_id remains None, action remains 'none'

        # 4. Log the unauthorized access attempt if we have a domain to log against
        if log_domain_id:
            try:
                log_entry = AccessLog(
                    domain_id=log_domain_id,
                    cloned_from_domain=visiting_domain_normalized, # Log the actual domain visited
                    user_agent=user_agent,
                    ip_address=ip_address,
                    referer=referer,
                    action_taken=action_to_take
                )
                db.session.add(log_entry)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                # Log the error internally, but proceed to return the action to the pixel
                print(f"Error logging unauthorized access: {e}") 
                # Consider if failure to log should change the outcome? For now, no.

        # 5. Return the unauthorized status and action
        response_data = {"status": "unauthorized", "action": action_to_take}
        if action_to_take in ["redirect", "replace_links"] and action_target:
            response_data["target"] = action_target
        
        return jsonify(response_data), 200

