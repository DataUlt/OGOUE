@echo off
REM Test Register
echo === TEST 1A: REGISTER ===
curl -X POST http://127.0.0.1:3001/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"firstName\":\"Benoit\",\"lastName\":\"Test\",\"email\":\"benoit@test.com\",\"password\":\"Test1234!\",\"organizationName\":\"OGOUE Demo\",\"rccmNumber\":\"RCCM-001\",\"nifNumber\":\"NIF-001\",\"activity\":\"Commerce\",\"activityDescription\":\"Org de test\"}"
echo.
pause
