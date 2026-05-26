$puzzleIds = Get-Content 'C:\Users\akasa\Documents\crosswordscrapping\archive-worker\scripts\temp\puzzle_ids.csv' 
$groupSize = 5 
$totalGroups = [Math]::Ceiling($puzzleIds.Count / $groupSize) 
for ($i=0; $i -lt $totalGroups; $i++) { 
  $start = $i * $groupSize 
  $end = [Math]::Min(($i + 1) * $groupSize - 1, $puzzleIds.Count - 1) 
  $group = $puzzleIds[$start..$end] -join ',' 
  $sql = "SELECT * FROM clues WHERE puzzle_id IN ($group);" 
