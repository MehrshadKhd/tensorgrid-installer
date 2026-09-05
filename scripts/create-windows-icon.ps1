param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function Write-UInt16LE {
    param([byte[]]$Buffer, [int]$Offset, [int]$Value)
    [BitConverter]::GetBytes([uint16]$Value).CopyTo($Buffer, $Offset)
}

function Write-UInt32LE {
    param([byte[]]$Buffer, [int]$Offset, [int]$Value)
    [BitConverter]::GetBytes([uint32]$Value).CopyTo($Buffer, $Offset)
}

function New-IconFrame {
    param([System.Drawing.Image]$SourceImage, [int]$Size)

    $bitmap = New-Object -TypeName System.Drawing.Bitmap -ArgumentList @(
        $Size,
        $Size,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($SourceImage, [System.Drawing.Rectangle]::new(0, 0, $Size, $Size))
    } finally {
        $graphics.Dispose()
    }

    $rectangle = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
    $locked = $bitmap.LockBits(
        $rectangle,
        [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    try {
        $stride = [Math]::Abs($locked.Stride)
        $pixelBytes = New-Object byte[] ($stride * $Size)
        [System.Runtime.InteropServices.Marshal]::Copy($locked.Scan0, $pixelBytes, 0, $pixelBytes.Length)
    } finally {
        $bitmap.UnlockBits($locked)
        $bitmap.Dispose()
    }

    $xorBytes = New-Object byte[] ($Size * $Size * 4)
    for ($row = 0; $row -lt $Size; $row++) {
        $sourceOffset = $row * $stride
        $targetOffset = ($Size - 1 - $row) * $Size * 4
        [Buffer]::BlockCopy($pixelBytes, $sourceOffset, $xorBytes, $targetOffset, $Size * 4)
    }

    $maskStride = [int]([Math]::Ceiling($Size / 32.0) * 4)
    $andBytes = New-Object byte[] ($maskStride * $Size)
    $dib = New-Object byte[] (40 + $xorBytes.Length + $andBytes.Length)
    Write-UInt32LE $dib 0 40
    Write-UInt32LE $dib 4 $Size
    Write-UInt32LE $dib 8 ($Size * 2)
    Write-UInt16LE $dib 12 1
    Write-UInt16LE $dib 14 32
    Write-UInt32LE $dib 16 0
    Write-UInt32LE $dib 20 ($xorBytes.Length)
    Write-UInt32LE $dib 24 0
    Write-UInt32LE $dib 28 0
    Write-UInt32LE $dib 32 0
    Write-UInt32LE $dib 36 0
    [Buffer]::BlockCopy($xorBytes, 0, $dib, 40, $xorBytes.Length)
    [Buffer]::BlockCopy($andBytes, 0, $dib, 40 + $xorBytes.Length, $andBytes.Length)
    return ,$dib
}

$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $InputPath))
try {
    $sizes = @(16, 32, 48, 96, 192, 256)
    $frames = @()
    foreach ($size in $sizes) {
        $frames += ,(New-IconFrame $sourceImage $size)
    }

    $directoryLength = 6 + (16 * $frames.Count)
    $totalLength = $directoryLength
    foreach ($frame in $frames) {
        $totalLength += $frame.Length
    }

    $ico = New-Object byte[] $totalLength
    Write-UInt16LE $ico 0 0
    Write-UInt16LE $ico 2 1
    Write-UInt16LE $ico 4 $frames.Count

    $dataOffset = $directoryLength
    for ($index = 0; $index -lt $frames.Count; $index++) {
        $size = $sizes[$index]
        $frame = $frames[$index]
        $directoryOffset = 6 + (16 * $index)
        $ico[$directoryOffset] = if ($size -ge 256) { 0 } else { [byte]$size }
        $ico[$directoryOffset + 1] = if ($size -ge 256) { 0 } else { [byte]$size }
        $ico[$directoryOffset + 2] = 0
        $ico[$directoryOffset + 3] = 0
        Write-UInt16LE $ico ($directoryOffset + 4) 1
        Write-UInt16LE $ico ($directoryOffset + 6) 32
        Write-UInt32LE $ico ($directoryOffset + 8) $frame.Length
        Write-UInt32LE $ico ($directoryOffset + 12) $dataOffset
        [Buffer]::BlockCopy($frame, 0, $ico, $dataOffset, $frame.Length)
        $dataOffset += $frame.Length
    }

    $outputDirectory = Split-Path -Parent $OutputPath
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    [System.IO.File]::WriteAllBytes($OutputPath, $ico)
} finally {
    $sourceImage.Dispose()
}
