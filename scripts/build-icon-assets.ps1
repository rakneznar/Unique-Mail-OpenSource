param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $ProjectRoot 'electron\assets\icon-source.png'
$source = [System.Drawing.Bitmap]::FromFile($sourcePath)
try {
  $minX = $source.Width
  $minY = $source.Height
  $maxX = -1
  $maxY = -1
  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      if ($source.GetPixel($x, $y).A -le 8) { continue }
      $minX = [Math]::Min($minX, $x)
      $minY = [Math]::Min($minY, $y)
      $maxX = [Math]::Max($maxX, $x)
      $maxY = [Math]::Max($maxY, $y)
    }
  }
  if ($maxX -lt 0) { throw 'The source icon contains no visible pixels.' }

  $crop = [System.Drawing.Rectangle]::FromLTRB($minX, $minY, $maxX + 1, $maxY + 1)
  $master = New-Object System.Drawing.Bitmap 512, 512, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($master)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $targetWidth = 482
      $targetHeight = [Math]::Round($crop.Height * $targetWidth / $crop.Width)
      $target = New-Object System.Drawing.Rectangle ([Math]::Floor((512 - $targetWidth) / 2)), ([Math]::Floor((512 - $targetHeight) / 2)), $targetWidth, $targetHeight
      $graphics.DrawImage($source, $target, $crop, [System.Drawing.GraphicsUnit]::Pixel)
    } finally {
      $graphics.Dispose()
    }

    $pngTargets = @(
      'electron\assets\icon.png',
      'public\unique-mail-logo.png',
      'src\assets\unique-mail-logo.png'
    )
    foreach ($relativePath in $pngTargets) {
      $targetPath = Join-Path $ProjectRoot $relativePath
      [System.IO.Directory]::CreateDirectory((Split-Path -Parent $targetPath)) | Out-Null
      $master.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }

    $sizes = @(16, 24, 32, 48, 64, 128, 256)
    $frames = New-Object System.Collections.Generic.List[byte[]]
    foreach ($size in $sizes) {
      $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
          $graphics.Clear([System.Drawing.Color]::Transparent)
          $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
          $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
          $graphics.DrawImage($master, 0, 0, $size, $size)
        } finally {
          $graphics.Dispose()
        }
        $stream = New-Object System.IO.MemoryStream
        try {
          $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
          $frames.Add($stream.ToArray())
        } finally {
          $stream.Dispose()
        }
      } finally {
        $bitmap.Dispose()
      }
    }

    function Write-Ico([string]$Path) {
      $output = [System.IO.File]::Create($Path)
      $writer = New-Object System.IO.BinaryWriter $output
      try {
        $writer.Write([UInt16]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]$sizes.Count)
        $offset = 6 + (16 * $sizes.Count)
        for ($index = 0; $index -lt $sizes.Count; $index++) {
          $size = $sizes[$index]
          $frame = $frames[$index]
          $writer.Write([Byte]$(if ($size -eq 256) { 0 } else { $size }))
          $writer.Write([Byte]$(if ($size -eq 256) { 0 } else { $size }))
          $writer.Write([Byte]0)
          $writer.Write([Byte]0)
          $writer.Write([UInt16]1)
          $writer.Write([UInt16]32)
          $writer.Write([UInt32]$frame.Length)
          $writer.Write([UInt32]$offset)
          $offset += $frame.Length
        }
        foreach ($frame in $frames) { $writer.Write($frame) }
      } finally {
        $writer.Dispose()
        $output.Dispose()
      }
    }

    Write-Ico (Join-Path $ProjectRoot 'electron\assets\icon.ico')
    Write-Ico (Join-Path $ProjectRoot 'public\favicon.ico')

    foreach ($size in @(16, 32, 48, 64, 128, 256)) {
      $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
          $graphics.Clear([System.Drawing.Color]::Transparent)
          $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $graphics.DrawImage($master, 0, 0, $size, $size)
        } finally {
          $graphics.Dispose()
        }
        $bitmap.Save((Join-Path $ProjectRoot "public\favicon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $bitmap.Dispose()
      }
    }
  } finally {
    $master.Dispose()
  }
} finally {
  $source.Dispose()
}
