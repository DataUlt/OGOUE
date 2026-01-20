# Script PowerShell pour mettre à jour le design des modules

$appDir = "c:\Users\Benoit NZIENGUI\Desktop\PFE-Version-Netflify\OGOUE\frontend\app"
$files = Get-ChildItem "$appDir\module_*.html" -Exclude "module_tableau_bord.html"

foreach ($file in $files) {
    Write-Host "Traitement: $($file.Name)"
    $content = Get-Content $file.FullName -Raw
    
    # Remplacer les fonts
    $content = $content -replace 'family=Inter:wght@400;500;600;700;800;900&display=swap', 'family=Manrope:wght@400;500;700;800&display=swap'
    
    # Remplacer Material Symbols
    $content = $content -replace 'Material\+Symbols\+Outlined&display=swap', 'Material+Symbols+Outlined:wght@300;400;500;600;700&display=swap'
    
    # Remplacer les couleurs primaires
    $content = $content -replace '"primary":\s*"#13ecc8"', '"primary": "#1de22e"'
    $content = $content -replace '"secondary":\s*"#27AE60"', '"secondary": "#1E3A5F"'
    
    # Remplacer les backgrounds
    $content = $content -replace '"background-light":\s*"#f6f8f8"', '"background-light": "#f6f8f6"'
    $content = $content -replace '"background-dark":\s*"#10221f"', '"background-dark": "#111712"'
    
    # Remplacer les textes
    $content = $content -replace '"text-light-primary":\s*"#0d1b19"', '"text-light-primary": "#0a0c0a"'
    $content = $content -replace '"text-light-secondary":\s*"#566573"', '"text-light-secondary": "#5c6c60"'
    
    # Remplacer les bordures
    $content = $content -replace '"border-light":\s*"#E2E8F0"', '"border-light": "#e8ede8"'
    $content = $content -replace '"card-dark":\s*"#1E293B"', '"card-dark": "#1a2622"'
    
    # Remplacer fontFamily
    $content = $content -replace 'fontFamily:\s*{\s*"display":\s*\["Inter",\s*"sans-serif"\]\s*}', 'fontFamily: { "display": ["Manrope", "sans-serif"] }'
    
    # Remplacer border-radius
    $content = $content -replace '"DEFAULT":\s*"0\.5rem"', '"DEFAULT": "1rem"'
    $content = $content -replace '"lg":\s*"0\.75rem"', '"lg": "2rem"'
    $content = $content -replace '"xl":\s*"1rem"', '"xl": "3rem"'
    
    # Remplacer icon weights
    $content = $content -replace "font-variation-settings:\s*'FILL'\s*0,'wght'\s*400,'GRAD'\s*0,'opsz'\s*24;", "font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;"
    
    # Sauvegarder
    Set-Content $file.FullName $content -Encoding UTF8
    Write-Host "OK - $($file.Name) mis a jour"
}

Write-Host "Tous les modules ont ete mis a jour!"
