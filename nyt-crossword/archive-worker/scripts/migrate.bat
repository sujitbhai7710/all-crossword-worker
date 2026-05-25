@echo off
REM Simplified migration script for Windows using SQLite command-line tool
REM No Node.js dependencies required

REM Enable delayed expansion for variables inside loops
setlocal enabledelayedexpansion

REM Configuration
set DB_PATH=..\scrapping\xwordinfo_db\nytcrosswordarchive.db
set D1_DB_NAME=crossword_archive
set BATCH_SIZE=5000
set SCRIPT_DIR=%~dp0
set TEMP_DIR=%SCRIPT_DIR%temp

REM Create temp directory if it doesn't exist
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

echo Starting migration from SQLite to Cloudflare D1...

REM Apply initial schema
echo Applying database schema...
call npx wrangler@4 d1 execute "%D1_DB_NAME%" --file=..\migrations\0000_initial_migration.sql

REM Migrate puzzles
echo Migrating puzzles...
sqlite3 "%DB_PATH%" ".mode insert puzzles" ".output %TEMP_DIR%\puzzles_export.sql" "SELECT * FROM puzzles;" ".quit"

REM Import puzzles to D1
echo Importing puzzles to D1...
call npx wrangler@4 d1 execute "%D1_DB_NAME%" --file="%TEMP_DIR%\puzzles_export.sql"

REM Create a list of puzzle IDs for batch processing
echo Getting puzzle IDs for batch processing...
sqlite3 "%DB_PATH%" ".output %TEMP_DIR%\puzzle_ids.txt" "SELECT DISTINCT puzzle_id FROM puzzles ORDER BY puzzle_id;" ".quit"

REM Get count of clues for progress tracking
for /f %%i in ('sqlite3 "%DB_PATH%" "SELECT COUNT(*) FROM clues;"') do set CLUE_COUNT=%%i
echo Found %CLUE_COUNT% clues to migrate.

REM Process puzzles in batches
echo Migrating clues by puzzle groups...
set PROCESSED=0

REM Read puzzle IDs into an array
set /a IDX=0
for /f %%a in (%TEMP_DIR%\puzzle_ids.txt) do (
    set PUZZLE_IDS[!IDX!]=%%a
    set /a IDX+=1
)
set TOTAL_PUZZLES=%IDX%

REM Process puzzle IDs in batches of 10
set PUZZLE_BATCH_SIZE=10
for /l %%i in (0,10,%TOTAL_PUZZLES%) do (
    set /a END=%%i+%PUZZLE_BATCH_SIZE%
    if !END! gtr %TOTAL_PUZZLES% set END=%TOTAL_PUZZLES%
    
    REM Create list of puzzle IDs for this batch
    set "PUZZLE_ID_LIST="
    for /l %%j in (%%i,1,!END!) do (
        if defined PUZZLE_IDS[%%j] (
            if not "!PUZZLE_ID_LIST!"=="" (
                set "PUZZLE_ID_LIST=!PUZZLE_ID_LIST!,"
            )
            set "PUZZLE_ID_LIST=!PUZZLE_ID_LIST!!PUZZLE_IDS[%%j]!"
        )
    )
    
    if not "!PUZZLE_ID_LIST!"=="" (
        echo Processing puzzles %%i to !END! of %TOTAL_PUZZLES%...
        
        REM Export clues for this group of puzzles
        set CURRENT_BATCH=%TEMP_DIR%\clues_batch_%%i.sql
        sqlite3 "%DB_PATH%" ".mode insert clues" ".output !CURRENT_BATCH!" "SELECT * FROM clues WHERE puzzle_id IN (!PUZZLE_ID_LIST!);" ".quit"
        
        REM Count clues in this batch
        for /f %%c in ('find /c "INSERT INTO clues" "!CURRENT_BATCH!"') do set BATCH_CLUES=%%c
        if !BATCH_CLUES! gtr 0 (
            echo Importing !BATCH_CLUES! clues to D1...
            call npx wrangler@4 d1 execute "%D1_DB_NAME%" --file="!CURRENT_BATCH!"
            
            set /a PROCESSED=!PROCESSED!+!BATCH_CLUES!
            set /a PERCENT=!PROCESSED!*100/%CLUE_COUNT%
            echo Progress: !PROCESSED! of %CLUE_COUNT% clues (!PERCENT!%%)
        )
    )
)

echo Migration complete!

REM Verify the migration
echo Verifying migration...
call npx wrangler@4 d1 execute "%D1_DB_NAME%" --command="SELECT COUNT(*) FROM puzzles;"
call npx wrangler@4 d1 execute "%D1_DB_NAME%" --command="SELECT COUNT(*) FROM clues;"

REM Clean up temporary files
echo Cleaning up temporary files...
rd /s /q "%TEMP_DIR%"

echo Done!

endlocal 