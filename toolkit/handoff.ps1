<#
  Code Sleuth's hand-off to ToolKit.

  It runs ToolKit's own verb, the offline form of NewPrompt, with the values it is given and nothing else:
  it never writes a card file and never passes -Now, -Force or any other switch. Every value arrives as its
  own argument; no command is ever built from text.

  Windows PowerShell 5.1-clean: no ternary, no ?? or ?., no -AsHashtable, no && or || chains.

  -Probe        Resolve <prefix>NewPrompt (which loads ToolKit) and print one line:
                CODE-SLEUTH-PROBE {"prefix":...,"space":...,"spaces":[...],"addresses":[...],"root":...,"folders":[...]}
                Each address is a Space's slug, its org (a repository's URL on GitHub, the organisation's on
                Azure DevOps) and its projects' repository names, so Code Sleuth can find the Space whose
                address is the investigated repository's origin.
  -ModuleRoot   Only for Code Sleuth's own tests: the one folder ToolKit is loaded from, set inside this
                shell, the way ToolKit's own suites isolate a checkout.
  Exit codes    0 done; 2 ToolKit stated a refusal (it printed Error: and Hint:); 3 ToolKit is not here;
                anything else a failure.
#>
param(
    [switch]$Probe,
    [string]$Prefix = 'tk',
    [string]$Title,
    [string]$Type,
    [string]$Description,
    [string]$ModuleRoot
)

if ($ModuleRoot) {
    $env:PSModulePath = $ModuleRoot
}

$verb = $Prefix + 'NewPrompt'
$command = Get-Command $verb -ErrorAction SilentlyContinue
if ($null -eq $command) {
    [Console]::Error.WriteLine("ToolKit's $verb is not available in this shell.")
    exit 3
}

if ($Probe) {
    # ToolKit's resolved settings, overrides included. $global:P20Config is what ToolKit's own code reads; it
    # is not a promise to callers, so its absence leaves the values null rather than failing.
    $config = $global:P20Config
    $resolvedPrefix = $null
    $space = $null
    $spaces = $null
    $addresses = $null
    $root = $null
    $folders = $null
    if ($null -ne $config) {
        $resolvedPrefix = $config.CommandPrefix
        $space = $config.ActiveSpace
        $root = $config.PromptsRoot
        # Where NewPrompt writes a card for the Space in play: its current/ and backlog/ folders, as ToolKit's
        # own Get-PromptFolders builds them. Code Sleuth refuses to file when either is inside the repository.
        if ($null -ne $root -and $root -ne '') {
            $base = [string]$root
            if ($null -ne $config.PromptsFolder -and [string]$config.PromptsFolder -ne '') {
                $base = Join-Path $base ([string]$config.PromptsFolder)
            }
            $folders = @((Join-Path $base 'current'), (Join-Path $base 'backlog'))
        }
        $spaces = @()
        $addresses = @()
        foreach ($entry in @($config.Spaces)) {
            if ($null -ne $entry -and $null -ne $entry.slug) {
                $spaces += [string]$entry.slug
                $repos = @()
                foreach ($project in @($entry.projects)) {
                    if ($null -ne $project -and $null -ne $project.repo) { $repos += [string]$project.repo }
                }
                $org = $null
                if ($null -ne $entry.org) { $org = [string]$entry.org }
                $address = New-Object PSObject
                $address | Add-Member -NotePropertyName slug -NotePropertyValue ([string]$entry.slug)
                $address | Add-Member -NotePropertyName org -NotePropertyValue $org
                $address | Add-Member -NotePropertyName repos -NotePropertyValue $repos
                $addresses += $address
            }
        }
    }
    $answer = New-Object PSObject
    $answer | Add-Member -NotePropertyName prefix -NotePropertyValue $resolvedPrefix
    $answer | Add-Member -NotePropertyName space -NotePropertyValue $space
    $answer | Add-Member -NotePropertyName spaces -NotePropertyValue $spaces
    $answer | Add-Member -NotePropertyName addresses -NotePropertyValue $addresses
    $answer | Add-Member -NotePropertyName root -NotePropertyValue $root
    $answer | Add-Member -NotePropertyName folders -NotePropertyValue $folders
    Write-Output ('CODE-SLEUTH-PROBE ' + (ConvertTo-Json -InputObject $answer -Compress -Depth 4))
    exit 0
}

try {
    & $verb -Title $Title -Type $Type -Description $Description
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
if ($null -eq $LASTEXITCODE) { exit 0 }
exit $LASTEXITCODE
