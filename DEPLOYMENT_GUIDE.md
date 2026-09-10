# Earth Anomaly Observatory - Pre-Deployment Checklist

## Current Status

✅ **Validation:** PASSED  
✅ **Configuration:** All files correct (app.json, manifest.json, executa.json)  
✅ **Bundle:** Built (753 KB)  
✅ **Git Repository:** Initialized  
❌ **Executas Binaries:** NOT YET BUILT (Required for publishing)

---

## Phase 1: Build Executas Binaries (REQUIRED)

### Why This Matters
Your app requires a Python Executa (earth-data tool). The Anna platform needs binaries built for **all 4 platforms**:
- `darwin-arm64` (Mac Apple Silicon)
- `darwin-x86_64` (Mac Intel)
- `linux-x86_64` (Critical for Anna Cloud)
- `windows-x86_64` (Windows)

### Option A: GitHub Actions (Recommended)
This builds all 4 platforms automatically in the cloud.

#### Steps:
1. **Create GitHub repository** (if not already done)
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/anna-earth-observer
   git push -u origin master
   ```

2. **Go to GitHub Actions tab**
   - URL: `https://github.com/YOUR_USERNAME/anna-earth-observer/actions`
   - Find workflow: "Build Earth Data Executa Binaries"
   - Click "Run workflow"
   - Enter version: `1.0.0`
   - Click "Run workflow"

3. **Wait for all 4 builds to complete** (~15-30 min total)
   - ✓ darwin-arm64
   - ✓ darwin-x86_64
   - ✓ linux-x86_64
   - ✓ windows-x86_64

4. **Download artifacts from GitHub Releases**
   - Go to Releases tab
   - Download all 8 files (4 binaries + 4 checksums)
   - Extract and place in: `executas/earth-data/dist/`

#### Expected file structure after download:
```
executas/earth-data/dist/
├── tool-dev-earth-data-1.0.0-darwin-arm64.tar.gz
├── tool-dev-earth-data-1.0.0-darwin-arm64.tar.gz.sha256
├── tool-dev-earth-data-1.0.0-darwin-x86_64.tar.gz
├── tool-dev-earth-data-1.0.0-darwin-x86_64.tar.gz.sha256
├── tool-dev-earth-data-1.0.0-linux-x86_64.tar.gz
├── tool-dev-earth-data-1.0.0-linux-x86_64.tar.gz.sha256
├── tool-dev-earth-data-1.0.0-windows-x86_64.zip
└── tool-dev-earth-data-1.0.0-windows-x86_64.zip.sha256
```

### Option B: Local Build (Windows Only - for testing)
Faster but only builds for Windows platform.

```bash
python build-binary.py
```

This creates the Windows binary locally. You still need GitHub Actions for the other 3 platforms.

---

## Phase 2: Verify Binaries

After downloading or building, verify:

```bash
# Check files exist
Get-ChildItem executas/earth-data/dist/ | Format-Table Name, Length

# Verify all 4 platforms present
"darwin-arm64", "darwin-x86_64", "linux-x86_64", "windows-x86_64" | ForEach-Object {
  $file = "executas/earth-data/dist/tool-dev-earth-data-1.0.0-$_.tar.gz"
  if ($_ -eq "windows-x86_64") { $file = $file -replace "\.tar\.gz", ".zip" }
  if (Test-Path $file) { Write-Host "✓ $_" } else { Write-Host "✗ $_ MISSING" }
}
```

---

## Phase 3: Update Configuration

Change executa.json to use binary distribution:

**File:** `executas/earth-data/executa.json`  
**Line:** Find `"active": "local"` and change to `"active": "binary"`

Before:
```json
"distribution": {
  "active": "local",
  ...
}
```

After:
```json
"distribution": {
  "active": "binary",
  ...
}
```

---

## Phase 4: Final Validation

```bash
# Re-validate with strict mode
anna-app validate --strict

# Should still pass since config was already validated
# The only change is the active profile setting
```

**Expected result:** ✓ validate passed

---

## Phase 5: Ready for Publishing

Once all binaries are in place and configuration is updated:

### Verify Setup
```bash
# Check login status
anna-app whoami

# Check app status (requires authentication)
anna-app apps status earth-anomaly-observatory --account https://anna.partners --json
```

### Dry Run (Optional)
```bash
# See what will be published without uploading
anna-app apps publish --dry-run --account https://anna.partners
```

### Actual Publish
```bash
# Upload and create immutable version
anna-app apps publish --account https://anna.partners
```

**This command will:**
- Upload the UI bundle (index.html + assets)
- Upload the earth-data Executa
- Upload all 4 platform binaries
- Create an immutable version on the Anna platform
- Print status on successful completion

---

## Phase 6: Post-Publish Testing

After `anna-app apps publish` succeeds:

1. **Check status**
   ```bash
   anna-app apps status earth-anomaly-observatory --account https://anna.partners --json
   ```

2. **Install through Developer Console**
   - Visit: https://anna.partners/developer
   - Find "Earth Anomaly Observatory"
   - Click "Install"
   - Wait for completion

3. **Test in Anna**
   - Open Anna application
   - Find "Installed Apps" → "Earth Anomaly Observatory"
   - Verify app loads
   - Test core functionality

4. **Submit for Review** (When ready for Marketplace)
   ```bash
   anna-app apps submit-review earth-anomaly-observatory --account https://anna.partners
   ```

---

## Troubleshooting

### Q: Device code authentication failing?
**A:** See the authentication section. You may need to:
- Ensure you're logged into Anna at https://anna.partners first
- Complete the browser approval step within 2 minutes
- Check if Anna platform is experiencing issues

### Q: Binary build failed on GitHub?
**A:** Check the workflow logs:
- Go to Actions tab
- Click the failed build
- Review the error in the log
- Common issues:
  - Wrong Python version
  - Missing dependencies
  - Platform-specific build issues

### Q: "linux-x86_64 must not be omitted" error?
**A:** Ensure the Linux binary is included. This is critical for Anna Cloud Agent support.

### Q: Files appear in dist/ but anna-app doesn't find them?
**A:** Check that:
- File paths in `executa.json` match exactly
- Entrypoint names are correct
- Archive format is right (tar.gz for Unix, zip for Windows)

---

## Summary Checklist

- [ ] Phase 1: Binaries built (local or GitHub Actions)
- [ ] Phase 2: All 4 binaries verified in `executas/earth-data/dist/`
- [ ] Phase 3: `executa.json` updated: `"active": "binary"`
- [ ] Phase 4: `anna-app validate --strict` passes
- [ ] Phase 5: Authenticated with `anna-app login`
- [ ] Phase 5: Ready to run `anna-app apps publish`
- [ ] Phase 6: App published and installed in Anna
- [ ] Phase 6: All features tested in actual Anna environment

---

## Next Steps

1. **Build binaries:**
   - Push to GitHub and run workflow, OR
   - Run local build script: `python build-binary.py`

2. **Download artifacts** and place in `executas/earth-data/dist/`

3. **Update executa.json** to set `active: binary`

4. **Complete authentication** with `anna-app login --host https://anna.partners`

5. **Publish app** with `anna-app apps publish --account https://anna.partners`

Good luck! 🚀
