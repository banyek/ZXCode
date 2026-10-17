10 REM Raw: PRINT 1E999 "unfinished {{0xFF}} \\n
20 LET a$="a""b:c": LET a$(2 TO 3)="XY": PRINT a$()(2 TO );("abc"+a$)(TO 3)
30 IF 1 THEN : PRINT "tail": REM : CLS "unfinished
40 : PRINT BIN :
