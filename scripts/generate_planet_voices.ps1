<#
.SYNOPSIS
Generates the site's bundled planet-name WAV files with Windows System.Speech.

.DESCRIPTION
Every clip uses one installed voice and explicit Microsoft SAPI phonemes. This
keeps uncommon names deterministic: the engine never sees spelling hints such
as "Mah-keh" or "Air-iss" that it might read as individual letters.

Examples:
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate_planet_voices.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate_planet_voices.ps1 -Only makemake,eris
#>

[CmdletBinding()]
param(
    [string] $OutputDir,
    [string[]] $Only = @(),
    [string] $Voice = 'Microsoft Zira Desktop'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $OutputDir) {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $OutputDir = Join-Path $projectRoot 'assets\planet-voices'
}

# slug = visible label, human-readable target, and SAPI phoneme segments.
# Separate segments create natural word/syllable boundaries without letting the
# speech engine read punctuation or letter names aloud.
$Pronunciations = [ordered]@{
    sun      = @{ Label = 'Sun';      Target = 'SUN';               Segments = @('s ah 1 n') }
    mercury  = @{ Label = 'Mercury';  Target = 'MER-cure-ee';       Segments = @('m er 1 k y er iy') }
    venus    = @{ Label = 'Venus';    Target = 'VEE-nuss';          Segments = @('v iy 1 n ax s') }
    earth    = @{ Label = 'Earth';    Target = 'EARTH';             Segments = @('er 1 th') }
    mars     = @{ Label = 'Mars';     Target = 'MARZ';              Segments = @('m aa 1 r z') }
    ceres    = @{ Label = 'Ceres';    Target = 'SEER-eez';          Segments = @('s ih 1 r iy z') }
    jupiter  = @{ Label = 'Jupiter';  Target = 'JOO-pih-ter';       Segments = @('jh uw 1 p ih t er') }
    saturn   = @{ Label = 'Saturn';   Target = 'SAT-urn';           Segments = @('s ae 1 t er n') }
    uranus   = @{ Label = 'Uranus';   Target = 'YOOR-un-nuss';      Segments = @('y uh 1 r ax n ax s') }
    neptune  = @{ Label = 'Neptune';  Target = 'NEP-toon';          Segments = @('n eh 1 p t uw n') }
    pluto    = @{ Label = 'Pluto';    Target = 'PLOO-toh';          Segments = @('p l uw 1 t ow') }
    haumea   = @{ Label = 'Haumea';   Target = 'HOW-may-ah';        Segments = @('h aw', 'm ey 1 ax') }
    makemake = @{ Label = 'Makemake'; Target = 'MAH-keh MAH-keh';   Segments = @('m aa 1 k eh', 'm aa 1 k eh') }
    eris     = @{ Label = 'Eris';     Target = 'AIR-iss';           Segments = @('eh 1 r ih s') }
}

$Selected = @($Only | ForEach-Object { $_ -split ',' } | Where-Object { $_ })

if ($Selected.Count -gt 0) {
    foreach ($slug in $Selected) {
        if (-not $Pronunciations.Contains($slug)) {
            throw "Unknown name '$slug'. Valid names: $($Pronunciations.Keys -join ', ')"
        }
    }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Add-Type -AssemblyName System.Speech
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()

try {
    $availableVoices = @($synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })
    if ($Voice -notin $availableVoices) {
        throw "Required voice '$Voice' is not installed. Available: $($availableVoices -join ', ')"
    }
    $synth.SelectVoice($Voice)

    foreach ($slug in $Pronunciations.Keys) {
        if ($Selected.Count -gt 0 -and $slug -notin $Selected) {
            continue
        }

        $entry = $Pronunciations[$slug]
        $label = [Security.SecurityElement]::Escape($entry.Label)
        $spokenSegments = [Collections.Generic.List[string]]::new()

        foreach ($phonemes in $entry.Segments) {
            if ($spokenSegments.Count -gt 0) {
                $spokenSegments.Add('<break time="75ms"/>')
            }
            $safePhonemes = [Security.SecurityElement]::Escape($phonemes)
            $spokenSegments.Add(
                "<phoneme alphabet=`"x-microsoft-sapi`" ph=`"$safePhonemes`">$label</phoneme>"
            )
        }

        $safeVoice = [Security.SecurityElement]::Escape($Voice)
        $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">' +
            "<voice name=`"$safeVoice`"><prosody pitch=`"+10%`" rate=`"+5%`">" +
            ($spokenSegments -join '') +
            '</prosody></voice></speak>'

        $destination = Join-Path $OutputDir "$slug.wav"
        $synth.SetOutputToWaveFile($destination)
        $synth.SpeakSsml($ssml)
        $synth.SetOutputToNull()

        $file = Get-Item -LiteralPath $destination
        if ($file.Length -lt 1000) {
            throw "Speech engine returned an empty clip: $destination"
        }
        '{0,-10} {1,7} bytes  {2,-8} {3}' -f $slug, $file.Length, $entry.Label, $entry.Target
    }
}
finally {
    $synth.Dispose()
}
