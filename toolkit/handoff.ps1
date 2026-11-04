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

# This script's own errors decide nothing by preference: an error the verb writes is read from its stream below.
# Set here, so a shell or profile default of Stop never changes how this script reads one.
$ErrorActionPreference = 'Continue'

# ToolKit's marker for a caller that is not a person at a terminal: it silences the first-run banner, and has
# ToolKit's guard throw a stated refusal or failure, rather than only setting $LASTEXITCODE and returning.
$env:TOOLKIT_QUIET_STARTUP = '1'

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

# The verb's own outcome, read by ToolKit's own contract (its AGENTS.md, "The refusal contract"). ToolKit's
# guard leaves $LASTEXITCODE as the verb's outcome: 0 success, 2 a stated refusal (it has printed Error: and
# Hint:), anything else a failure. With TOOLKIT_QUIET_STARTUP set, as above, the guard also throws a refusal or
# a failure, with $LASTEXITCODE set first. An error ToolKit writes and does not handle comes through its error
# stream, and is a failure though nothing throws; a native program's stderr (git) comes through as a
# RemoteException record, and is passed on as text.
$verbErrors = 0
$global:LASTEXITCODE = 0
try {
    & $verb -Title $Title -Type $Type -Description $Description 2>&1 | ForEach-Object {
        if ($_ -is [System.Management.Automation.ErrorRecord]) {
            [Console]::Error.WriteLine($_.ToString())
            if (-not ($_.Exception -is [System.Management.Automation.RemoteException])) { $verbErrors = $verbErrors + 1 }
        }
        else { $_ }
    }
}
catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    if ($LASTEXITCODE -eq 2) { exit 2 }
    exit 1
}
if ($verbErrors -gt 0) { exit 1 }
# A ToolKit that states a refusal and returns, without throwing: its $LASTEXITCODE says so all the same.
if ($LASTEXITCODE -eq 2) { exit 2 }
if ($LASTEXITCODE) { exit 1 }
exit 0
