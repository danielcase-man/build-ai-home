/**
 * DWG/DXF Plan Extraction — feeds structural data into the takeoff pipeline.
 *
 * Usage:
 *   node scripts/extract-dwg.mjs <path-to-dxf-file>     # Direct DXF extraction
 *   node scripts/extract-dwg.mjs --convert <dwg-file>    # Convert DWG→DXF first
 *
 * For DWG conversion, requires one of:
 *   - ODA File Converter (free): https://www.opendesign.com/guestfiles/oda_file_converter
 *   - Python ezdxf (for DXF only): pip install ezdxf
 *   - CloudConvert API: https://cloudconvert.com/dwg-to-dxf
 *
 * The @mlightcad/libredwg-web WASM package has a Windows path-length issue
 * (base64 data URI exceeds 260-char limit). Works fine on Linux/Mac.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, basename, extname } from 'path'
import { execSync } from 'child_process'

const args = process.argv.slice(2)
const isConvert = args[0] === '--convert'
const filePath = resolve(isConvert ? args[1] : args[0])

if (!filePath || !existsSync(filePath)) {
  console.error('Usage: node scripts/extract-dwg.mjs <path-to-dxf-or-dwg-file>')
  console.error('       node scripts/extract-dwg.mjs --convert <path-to-dwg-file>')
  process.exit(1)
}

const ext = extname(filePath).toLowerCase()

// If DWG, try to convert to DXF first
if (ext === '.dwg') {
  const dxfPath = filePath.replace(/\.dwg$/i, '.dxf')

  if (existsSync(dxfPath)) {
    console.log(`DXF already exists: ${dxfPath}`)
    console.log('Using existing DXF file.')
    extractDXF(dxfPath)
  } else {
    console.log('DWG file detected. Attempting conversion...')

    // Try ODA File Converter
    try {
      const odaPath = 'C:/Program Files/ODA/ODAFileConverter/ODAFileConverter.exe'
      if (existsSync(odaPath)) {
        console.log('Using ODA File Converter...')
        // ODA converts whole directories
        const dir = resolve(filePath, '..')
        execSync(`"${odaPath}" "${dir}" "${dir}" "ACAD2018" "DXF" "0" "1" "${basename(filePath)}"`)
        if (existsSync(dxfPath)) {
          console.log(`Converted: ${dxfPath}`)
          extractDXF(dxfPath)
        } else {
          console.error('ODA conversion produced no output')
          showFallbacks()
        }
      } else {
        throw new Error('ODA not installed')
      }
    } catch {
      // Try Python ezdxf odafc wrapper
      try {
        execSync(`python -c "import odafc; odafc.convert('${filePath.replace(/\\/g, '/')}', '${dxfPath.replace(/\\/g, '/')}', version='R2018')"`, { stdio: 'pipe' })
        if (existsSync(dxfPath)) {
          console.log(`Converted via Python odafc: ${dxfPath}`)
          extractDXF(dxfPath)
        } else {
          throw new Error('No output')
        }
      } catch {
        showFallbacks()
      }
    }
  }
} else if (ext === '.dxf') {
  extractDXF(filePath)
} else {
  console.error(`Unsupported file type: ${ext}. Expected .dwg or .dxf`)
  process.exit(1)
}

function extractDXF(dxfPath) {
  console.log(`\nExtracting: ${basename(dxfPath)} (${(readFileSync(dxfPath).length / 1024).toFixed(0)} KB)`)

  const content = readFileSync(dxfPath, 'utf8')

  // Quick DXF stats
  const sectionMatches = content.match(/^SECTION$/gm)
  const entityMatches = content.match(/^(LINE|CIRCLE|ARC|TEXT|MTEXT|DIMENSION|INSERT|LWPOLYLINE|POLYLINE|SPLINE)$/gm)

  console.log(`Sections: ${sectionMatches?.length || 0}`)
  console.log(`Entity markers: ${entityMatches?.length || 0}`)

  // Extract all text entities for quick inspection
  const textPattern = /\n\s*1\n([^\n]+)/g
  const texts = []
  let match
  while ((match = textPattern.exec(content)) !== null) {
    const text = match[1].trim()
    if (text.length > 2 && !text.startsWith('0') && !text.match(/^[0-9.]+$/)) {
      texts.push(text)
    }
  }

  console.log(`\n=== TEXT CONTENT (${texts.length} items) ===`)
  const unique = [...new Set(texts)]
  for (const t of unique.slice(0, 100)) {
    console.log(`  ${t}`)
  }

  // Save for the DXF extractor pipeline
  const outputPath = dxfPath.replace(/\.dxf$/i, '-text-content.json')
  writeFileSync(outputPath, JSON.stringify({ texts: unique, count: unique.length }, null, 2))
  console.log(`\nText content saved to: ${outputPath}`)
  console.log(`\nTo run full extraction, import and call extractFromDXF() from src/lib/dxf-extractor.ts`)
}

function showFallbacks() {
  console.log(`
No DWG converter found. Options:

1. EASIEST: Ask the sender to re-export as DXF from AutoCAD
   (File → Save As → DXF format)

2. INSTALL ODA File Converter (free, 50MB):
   https://www.opendesign.com/guestfiles/oda_file_converter
   Download Windows x64 version, install, then re-run this script.

3. ONLINE: Upload to https://cloudconvert.com/dwg-to-dxf
   Download the DXF, save next to the DWG file, re-run.

4. PYTHON: pip install odafc (wraps ODA File Converter)
`)
  process.exit(1)
}
