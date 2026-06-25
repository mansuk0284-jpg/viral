<#
.SYNOPSIS
  네이버 검색 Open API로 블로그/카페글을 검색해 JSON으로 반환한다.

.DESCRIPTION
  하네스 review-collector가 네이버 카페·블로그 후기를 수집할 때 호출한다.
  Client ID/Secret은 환경변수에서 읽는다 (코드/산출물에 키를 남기지 않음):
    $env:NAVER_CLIENT_ID, $env:NAVER_CLIENT_SECRET

.PARAMETER Query
  검색어. 예: "롯데 부산본점 삼성스토어 혼수 냉장고"

.PARAMETER Type
  blog | cafearticle (기본 cafearticle)

.PARAMETER Display
  결과 수 (1~100, 기본 50)

.PARAMETER Sort
  sim(정확도) | date(최신). 기본 date

.EXAMPLE
  pwsh ./scripts/naver-search.ps1 -Query "신세계 센텀 삼성 LG 혼수" -Type blog -Display 50
#>
param(
  [Parameter(Mandatory = $true)][string]$Query,
  [ValidateSet('blog', 'cafearticle')][string]$Type = 'cafearticle',
  [ValidateRange(1, 100)][int]$Display = 50,
  [ValidateSet('sim', 'date')][string]$Sort = 'date'
)

$clientId = $env:NAVER_CLIENT_ID
$clientSecret = $env:NAVER_CLIENT_SECRET

if ([string]::IsNullOrWhiteSpace($clientId) -or [string]::IsNullOrWhiteSpace($clientSecret)) {
  Write-Error "환경변수 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 가 설정되지 않았습니다. data/naver-api.md 참조."
  exit 1
}

$uri = "https://openapi.naver.com/v1/search/$Type.json"
$headers = @{
  'X-Naver-Client-Id'     = $clientId
  'X-Naver-Client-Secret' = $clientSecret
}
$params = @{
  query   = $Query
  display = $Display
  sort    = $Sort
}

try {
  $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Body $params -Method Get -ErrorAction Stop
}
catch {
  Write-Error "네이버 API 호출 실패: $($_.Exception.Message)"
  exit 2
}

# HTML 태그(<b> 등) 제거 후 핵심 필드만 정리해 JSON 출력
$items = foreach ($it in $resp.items) {
  [pscustomobject]@{
    title       = ($it.title       -replace '<[^>]+>', '')
    description = ($it.description  -replace '<[^>]+>', '')
    link        = $it.link
    cafename    = $it.cafename      # cafearticle 전용
    bloggername = $it.bloggername   # blog 전용
    postdate    = $it.postdate      # blog 전용 (YYYYMMDD)
  }
}

[pscustomobject]@{
  query    = $Query
  type     = $Type
  total    = $resp.total
  returned = $items.Count
  items    = $items
} | ConvertTo-Json -Depth 5
