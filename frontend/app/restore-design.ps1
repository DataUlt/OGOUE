# Script pour régénérer les fichiers avec les bonnes polices depuis les fichiers source d'origine

$appDir = "c:\Users\Benoit NZIENGUI\Desktop\PFE-Version-Netflify\OGOUE\frontend\app"

# Liste des fichiers à traiter avec leur restore depuis git ou rechargement
$files = @(
    "module_agents.html",
    "module_agent_dashboard.html", 
    "module_agent_depenses.html",
    "module_agent_resume.html",
    "module_depenses.html",
    "module_depot_dossier.html",
    "module_etats_financiers.html",
    "module_historique_suppressions.html",
    "module_resume_ventes_depenses.html",
    "module_scoring.html",
    "module_ventes.html"
)

Write-Host "Restauration des fichiers depuis git..."

foreach ($file in $files) {
    $filePath = "$appDir\$file"
    Write-Host "Traitement: $file"
    
    # Restaurer depuis git (si disponible)
    & git -C $appDir checkout HEAD -- $file 2>$null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Git non disponible, skipping: $file"
        continue
    }
    
    # Maintenant appliquer les changements de design
    $content = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
    
    # Remplacer les fonts
    $content = $content -replace 'family=Inter:wght@400;500;600;700;800;900&display=swap', 'family=Manrope:wght@400;500;700;800&display=swap'
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
    
    # Sauvegarder avec UTF-8
    [System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
    Write-Host "OK - $file restaure et mis a jour"
}

Write-Host "Tous les fichiers ont ete restaures!"
