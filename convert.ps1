$w = New-Object -ComObject Word.Application
$w.Visible = $false
$d = $w.Documents.Open("D:\wms-vinhgiang_repo\WMS_VinhGiang_UseCases_ByRole1.docx")
$t = $d.Content.Text
$d.Close($false)
$w.Quit()
$t | Out-File -Encoding utf8 "D:\wms-vinhgiang_repo\usecases_byrole.txt"
Write-Host "Done"
