param(
  [string]$SourceDirectory = "C:\Users\cur7i\Pictures",
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\assets\art")
)

Add-Type -AssemblyName System.Drawing

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null

function Save-Jpeg {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path,
    [int]$MaxWidth = 1600,
    [int]$MaxHeight = 1600,
    [int]$Quality = 91
  )

  $scale = [Math]::Min(1.0, [Math]::Min($MaxWidth / $Bitmap.Width, $MaxHeight / $Bitmap.Height))
  $width = [Math]::Max(1, [int][Math]::Round($Bitmap.Width * $scale))
  $height = [Math]::Max(1, [int][Math]::Round($Bitmap.Height * $scale))
  $output = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $output.SetResolution(96, 96)
  $graphics = [System.Drawing.Graphics]::FromImage($output)
  try {
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($Bitmap, 0, 0, $width, $height)
  }
  finally {
    $graphics.Dispose()
  }

  $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object MimeType -eq 'image/jpeg' |
    Select-Object -First 1
  $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
  $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
    [System.Drawing.Imaging.Encoder]::Quality,
    [long]$Quality
  )
  try {
    $output.Save($Path, $encoder, $parameters)
  }
  finally {
    $parameters.Dispose()
    $output.Dispose()
  }
}

function Open-CroppedBitmap {
  param(
    [string]$Path,
    [System.Drawing.Rectangle]$Crop,
    [System.Drawing.RotateFlipType]$Rotate = [System.Drawing.RotateFlipType]::RotateNoneFlipNone
  )

  $source = [System.Drawing.Bitmap]::FromFile($Path)
  try {
    if ($Rotate -ne [System.Drawing.RotateFlipType]::RotateNoneFlipNone) {
      $source.RotateFlip($Rotate)
    }
    $safeCrop = [System.Drawing.Rectangle]::Intersect(
      $Crop,
      [System.Drawing.Rectangle]::new(0, 0, $source.Width, $source.Height)
    )
    return $source.Clone($safeCrop, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  }
  finally {
    $source.Dispose()
  }
}

# Preserve Vincent's original marks. These trims only remove scanner edges and blank spill.
$daddy = Open-CroppedBitmap `
  -Path (Join-Path $SourceDirectory 'vc_daddy.jpeg') `
  -Crop ([System.Drawing.Rectangle]::new(18, 16, 2514, 3492))
try { Save-Jpeg $daddy (Join-Path $resolvedOutput 'for-daddy.jpg') -MaxWidth 1200 -MaxHeight 1600 }
finally { $daddy.Dispose() }

$pokeWorld = Open-CroppedBitmap `
  -Path (Join-Path $SourceDirectory 'vc_poke2.jpeg') `
  -Rotate ([System.Drawing.RotateFlipType]::Rotate90FlipNone) `
  -Crop ([System.Drawing.Rectangle]::new(22, 14, 3484, 2508))
try { Save-Jpeg $pokeWorld (Join-Path $resolvedOutput 'pokemon-world.jpg') -MaxWidth 1600 -MaxHeight 1200 }
finally { $pokeWorld.Dispose() }

# The sizing table was written over an otherwise blank part of the scan by an adult.
# Cover only that note area before rotating; the child's artwork remains pixel-for-pixel intact.
$pokeSource = [System.Drawing.Bitmap]::FromFile((Join-Path $SourceDirectory 'vc_poke.jpeg'))
try {
  $noteGraphics = [System.Drawing.Graphics]::FromImage($pokeSource)
  try {
    $paper = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    try {
      $noteGraphics.FillRectangle($paper, 1775, 1730, 752, 1515)
    }
    finally { $paper.Dispose() }
  }
  finally { $noteGraphics.Dispose() }
  $pokeSource.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)
  $pokeBattle = $pokeSource.Clone(
    [System.Drawing.Rectangle]::new(18, 18, $pokeSource.Width - 36, $pokeSource.Height - 36),
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  )
  try { Save-Jpeg $pokeBattle (Join-Path $resolvedOutput 'pokemon-battle.jpg') -MaxWidth 1600 -MaxHeight 1200 }
  finally { $pokeBattle.Dispose() }
}
finally { $pokeSource.Dispose() }

$balloon = Open-CroppedBitmap `
  -Path (Join-Path $SourceDirectory 'vc_finger.jpeg') `
  -Rotate ([System.Drawing.RotateFlipType]::Rotate90FlipNone) `
  -Crop ([System.Drawing.Rectangle]::new(22, 14, 3484, 2508))
try { Save-Jpeg $balloon (Join-Path $resolvedOutput 'balloon-painting.jpg') -MaxWidth 1600 -MaxHeight 1200 }
finally { $balloon.Dispose() }

Get-ChildItem -LiteralPath $resolvedOutput -Filter '*.jpg' |
  Select-Object Name, Length
