10 SAVE "program" LINE 10: LOAD "": VERIFY "program": MERGE "extra"
20 SAVE "numbers" DATA a(): LOAD "strings" DATA b$(): VERIFY "numbers" DATA a()
30 SAVE "screen" SCREEN$: LOAD "screen" SCREEN$: VERIFY "screen" SCREEN$
40 SAVE "bytes" CODE 32768,16: LOAD "bytes" CODE: VERIFY "bytes" CODE 32768
50 LIST #2;15: LLIST #3,10
