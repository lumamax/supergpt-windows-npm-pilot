param(
    [Parameter(Mandatory)][string]$ModulePath,
    [Parameter(Mandatory)][ValidatePattern('^[a-f0-9]{64}$')][string]$Sha256,
    [Parameter(Mandatory)][long]$Bytes,
    [switch]$Launch
)

$ErrorActionPreference = 'Stop'
$phase = 'module_open'
$hold = $null
try {
    # Keep the same bytes protected from replacement until the engine returns.
    $hold = [IO.File]::Open($ModulePath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $phase = 'module_integrity'
    $hasher = [Security.Cryptography.SHA256]::Create()
    try {
        if ($hold.Length -ne $Bytes) { throw [IO.InvalidDataException]::new('Module size mismatch') }
        $digest = [BitConverter]::ToString($hasher.ComputeHash($hold)).Replace('-', '').ToLowerInvariant()
        if ($digest -cne $Sha256) { throw [IO.InvalidDataException]::new('Module digest mismatch') }
    } finally {
        $hasher.Dispose()
    }

    $phase = 'module_load'
    $assembly = [Reflection.Assembly]::LoadFrom($ModulePath)
    $installer = $assembly.GetType('LumaCloud.TrayInstaller.NpmFirstInstall', $true)
    $run = $installer.GetMethod('Run', [type[]] @([bool]))
    $phase = 'engine_entry'
    [Console]::WriteLine($run.Invoke($null, [object[]] @($Launch.IsPresent)))
} catch {
    $errorInfo = $_.Exception
    [Console]::WriteLine((@{
        schema = 'luma.windows.npm-host-error.v1'
        phase = $phase
        exceptionType = $errorInfo.GetType().FullName
        hresult = $errorInfo.HResult
    } | ConvertTo-Json -Compress))
    exit 1
} finally {
    if ($null -ne $hold) { $hold.Dispose() }
}
