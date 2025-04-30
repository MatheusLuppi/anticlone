import os
import sys

# Get the absolute path of the directory containing this script
script_dir = os.path.dirname(os.path.abspath(__file__))
# Add the script's directory (project root) to the Python path
sys.path.insert(0, script_dir)

# Now imports starting from 'src' should work
try:
    from src.main import app, db
except ModuleNotFoundError as e:
    print(f"Error importing from src: {e}")
    print("Ensure the script is run from the project root directory.")
    sys.exit(1)
except Exception as e:
    print(f"An unexpected error occurred during import: {e}")
    sys.exit(1)

with app.app_context():
    print("Creating database tables...")
    try:
        db.create_all()
        print("Database tables created (if they didn't exist).")
    except Exception as e:
        print(f"Error creating database tables: {e}")
        import traceback
        traceback.print_exc()

