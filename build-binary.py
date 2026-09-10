#!/usr/bin/env python3
"""
Local build script for Earth Data Executa binary
Builds a single-platform binary for the current system
"""

import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path

def main():
    executa_dir = Path(__file__).parent / "executas" / "earth-data"
    dist_dir = executa_dir / "dist"
    
    print("=" * 60)
    print("Earth Data Executa - Local Binary Builder")
    print("=" * 60)
    print()
    
    # Check Python version
    print(f"Python: {sys.version}")
    print(f"Platform: {platform.system()} {platform.machine()}")
    print()
    
    # Create dist directory
    dist_dir.mkdir(exist_ok=True)
    print(f"✓ Dist directory: {dist_dir}")
    
    # Install PyInstaller
    print("\nInstalling PyInstaller...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "PyInstaller"])
    
    # Change to executa directory
    os.chdir(executa_dir)
    
    # Determine platform suffix
    system = platform.system()
    machine = platform.machine()
    
    if system == "Darwin":
        if machine == "arm64":
            platform_suffix = "darwin-arm64"
        else:
            platform_suffix = "darwin-x86_64"
    elif system == "Linux":
        platform_suffix = "linux-x86_64"
    elif system == "Windows":
        platform_suffix = "windows-x86_64"
    else:
        platform_suffix = "unknown"
    
    print(f"\n✓ Detected platform: {platform_suffix}")
    
    # Build binary
    print("\nBuilding binary with PyInstaller...")
    build_dir = executa_dir / f"build-{platform_suffix}"
    
    subprocess.check_call([
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--name", "tool-dev-earth-data",
        "--distpath", str(dist_dir / f"dist-{platform_suffix}" / "bin"),
        "main.py"
    ])
    
    print(f"\n✓ Binary built successfully!")
    print(f"  Location: {dist_dir / f'dist-{platform_suffix}' / 'bin'}")
    
    # List output
    bin_dir = dist_dir / f"dist-{platform_suffix}" / "bin"
    if bin_dir.exists():
        print(f"\nContents of {bin_dir.name}:")
        for file in bin_dir.iterdir():
            size_kb = file.stat().st_size / 1024
            print(f"  - {file.name} ({size_kb:.1f} KB)")
    
    print("\n" + "=" * 60)
    print("Next steps:")
    print("1. For all 4 platforms: push to GitHub and use GitHub Actions workflow")
    print("2. Download artifacts from GitHub Releases")
    print("3. Place in executas/earth-data/dist/")
    print("4. Update executa.json: set 'active' to 'binary'")
    print("5. Run: anna-app apps publish")
    print("=" * 60)

if __name__ == "__main__":
    main()
