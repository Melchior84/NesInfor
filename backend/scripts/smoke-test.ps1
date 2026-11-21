<#
  Smoke test ponta a ponta da API NesInfor.

  Pre-requisitos:
    - API rodando (npm run start:dev) e .env configurado
    - Um ADMIN existente:  npm run create-admin -- admin@empresa.com "Admin" "SenhaForte123"

  Uso:
    powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1 -AdminEmail admin@empresa.com -AdminSenha SenhaForte123
#>
param(
  [string]$BaseUrl = 'http://localhost:3000/api',
  [Parameter(Mandatory = $true)][string]$AdminEmail,
  [Parameter(Mandatory = $true)][string]$AdminSenha
)

$ErrorActionPreference = 'Stop'
$falhas = 0

function Call($metodo, $caminho, $corpo = $null, $token = $null, $esperado = 200) {
  $h = @{}
  if ($token) { $h['Authorization'] = "Bearer $token" }
  $p = @{ Method = $metodo; Uri = "$BaseUrl$caminho"; Headers = $h; ContentType = 'application/json'; UseBasicParsing = $true }
  if ($corpo) { $p['Body'] = ($corpo | ConvertTo-Json -Depth 6) }
  # Compativel com Windows PowerShell 5.1 e PowerShell 7
  $texto = ''
  try {
    $resp = Invoke-WebRequest @p
    $sc = [int]$resp.StatusCode
    $texto = $resp.Content
  } catch {
    $sc = [int]$_.Exception.Response.StatusCode
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $texto = $_.ErrorDetails.Message }
    else {
      $leitor = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $texto = $leitor.ReadToEnd()
    }
  }
  $r = if ($texto) { $texto | ConvertFrom-Json } else { $null }
  if ($sc -ne $esperado) {
    $script:falhas++
    Write-Host "  [FALHA] $metodo $caminho -> $sc (esperado $esperado) $($r | ConvertTo-Json -Compress -Depth 4)" -ForegroundColor Red
  } else {
    Write-Host "  [ok] $metodo $caminho -> $sc" -ForegroundColor Green
  }
  return $r
}
function Confere($descricao, $condicao) {
  if ($condicao) { Write-Host "  [ok] $descricao" -ForegroundColor Green }
  else { $script:falhas++; Write-Host "  [FALHA] $descricao" -ForegroundColor Red }
}

$suf = Get-Random -Maximum 99999
$senha = 'SenhaForte123'

Write-Host "`n== 1. Cadastro e login =="
$ana = Call POST '/auth/register' @{ nome = 'Ana'; email = "ana$suf@teste.com"; senha = $senha } $null 201
$paula = Call POST '/auth/register' @{ nome = 'Paula'; email = "paula$suf@teste.com"; senha = $senha } $null 201
$carlos = Call POST '/auth/register' @{ nome = 'Carlos'; email = "carlos$suf@teste.com"; senha = $senha } $null 201
Call POST '/auth/register' @{ nome = 'Ana'; email = "ana$suf@teste.com"; senha = $senha } $null 409 | Out-Null
Call POST '/auth/login' @{ email = "ana$suf@teste.com"; senha = 'errada123' } $null 401 | Out-Null
$admin = Call POST '/auth/login' @{ email = $AdminEmail; senha = $AdminSenha } $null 200
Call GET '/auth/me' $null $ana.token | Out-Null
Call GET '/auth/me' $null $null 401 | Out-Null

Write-Host "`n== 2. Catalogo e historico de precos =="
Call POST '/capsulas' @{ nome = "Caramello $suf"; precoAtual = 10 } $ana.token 403 | Out-Null
$cap = Call POST '/capsulas' @{ nome = "Caramello $suf"; precoAtual = 10 } $admin.token 201
Call PUT "/capsulas/$($cap.id)" @{ precoAtual = 12 } $admin.token | Out-Null
$hist = Call GET "/capsulas/$($cap.id)/historico-precos" $null $admin.token
Confere 'historico tem 2 registros (10 e 12)' (@($hist).Count -eq 2)

Write-Host "`n== 3. Rodada e organizador =="
$rod = Call POST '/rodadas' @{ titulo = "Rodada teste $suf" } $ana.token 201
Confere 'rodada nasce sem organizador' ($null -eq $rod.organizadorId)
Call POST '/rodadas' @{ titulo = 'Outra' } $ana.token 409 | Out-Null
Call POST "/rodadas/$($rod.id)/assumir" $null $paula.token | Out-Null
Call POST "/rodadas/$($rod.id)/assumir" $null $carlos.token 409 | Out-Null

Write-Host "`n== 4. Pedidos (25 + 20 + 5 = 1 caixa) =="
Call PUT "/rodadas/$($rod.id)/meu-pedido/itens/$($cap.id)" @{ quantidade = 25 } $ana.token | Out-Null
Call PUT "/rodadas/$($rod.id)/meu-pedido/itens/$($cap.id)" @{ quantidade = 20 } $paula.token | Out-Null
Call PUT "/rodadas/$($rod.id)/meu-pedido/itens/$($cap.id)" @{ quantidade = 5 } $carlos.token | Out-Null
$painel = Call GET "/rodadas/$($rod.id)/painel-caixas" $null $carlos.token
$s = $painel.sabores[0]
Confere 'total 50, 1 caixa fechada, faltam 0' ($s.totalSolicitado -eq 50 -and $s.caixasFechadas -eq 1 -and $s.faltamProximaCaixa -eq 0)
Confere 'transparencia: 3 participantes visiveis' (@($s.participantes).Count -eq 3)
Confere 'compra Nespresso = 50 x 12 = 600' ($painel.resumo.valorCompraNespresso -eq 600)

Write-Host "`n== 5. Preco congelado =="
Call PUT "/capsulas/$($cap.id)" @{ precoAtual = 15 } $admin.token | Out-Null
$meu = Call GET "/rodadas/$($rod.id)/meu-pedido" $null $ana.token
Confere 'item da Ana mantem preco 12 apos reajuste' ($meu.itens[0].precoUnitario -eq 12)
Call PUT "/rodadas/$($rod.id)/meu-pedido/itens/$($cap.id)" @{ quantidade = 25 } $ana.token | Out-Null

Write-Host "`n== 6. Permissoes do organizador =="
Call PATCH "/rodadas/$($rod.id)/status" @{ status = 'FECHADO' } $carlos.token 403 | Out-Null
Call GET "/rodadas/$($rod.id)/participantes" $null $carlos.token 403 | Out-Null
Call PATCH "/rodadas/$($rod.id)/status" @{ status = 'ENTREGUE' } $paula.token 400 | Out-Null
Call PATCH "/rodadas/$($rod.id)/status" @{ status = 'FECHADO' } $paula.token | Out-Null
Call PUT "/rodadas/$($rod.id)/meu-pedido/itens/$($cap.id)" @{ quantidade = 30 } $ana.token 409 | Out-Null

Write-Host "`n== 7. Pagamento e ciclo de vida =="
$parts = Call GET "/rodadas/$($rod.id)/participantes" $null $paula.token
$solAna = ($parts.participantes | Where-Object { $_.nome -eq 'Ana' }).solicitacaoId
Confere 'Ana deve 25 x 12 = 300' (($parts.participantes | Where-Object { $_.nome -eq 'Ana' }).valorAPagar -eq 300)
Call PATCH "/rodadas/$($rod.id)/participantes/$solAna/pagamento" @{ status = 'PAGO' } $paula.token | Out-Null
Call PATCH "/rodadas/$($rod.id)/participantes/$solAna/pagamento" @{ status = 'PAGO' } $carlos.token 403 | Out-Null
$resumo = Call GET "/rodadas/$($rod.id)/resumo-compra" $null $ana.token
Confere 'resumo de compra: 1 caixa' ($resumo.totalCaixas -eq 1)
Call PATCH "/rodadas/$($rod.id)/status" @{ status = 'COMPRADO' } $admin.token | Out-Null   # ADMIN tambem pode
Call PATCH "/rodadas/$($rod.id)/status" @{ status = 'ENTREGUE' } $paula.token | Out-Null

Write-Host "`n== Resultado =="
if ($falhas -eq 0) { Write-Host 'TODOS OS TESTES PASSARAM' -ForegroundColor Green }
else { Write-Host "$falhas FALHA(S)" -ForegroundColor Red; exit 1 }
