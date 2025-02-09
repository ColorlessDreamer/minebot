import os
from pathlib import Path

def print_project_structure():
    # Get current working directory
    cwd = Path.cwd()
    print(f"Current working directory: {cwd}")
    
    # Check .env file
    env_path = cwd / '.env'
    print(f"\n.env file path: {env_path}")
    print(f".env exists: {env_path.exists()}")
    
    # Print controller directory structure
    controller_dir = cwd / 'controller'
    print(f"\nController directory: {controller_dir}")
    print(f"Controller exists: {controller_dir.exists()}")
    
    # Directories to ignore
    ignore_dirs = {'node_modules', '__pycache__', '.git'}
    
    # Print contents of directories
    print("\nDirectory contents:")
    for path in cwd.rglob('*'):
        # Skip ignored directories
        if any(ignored in str(path) for ignored in ignore_dirs):
            continue
            
        if path.is_file():
            print(f"File: {path.relative_to(cwd)}")
        elif path.is_dir():
            print(f"Dir:  {path.relative_to(cwd)}")

if __name__ == "__main__":
    print_project_structure()
