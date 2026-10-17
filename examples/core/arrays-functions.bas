10 DIM a(3): DIM b$(3,8)
20 DATA 2,"one",4,"two",6,"three"
30 FOR i=1 TO 3: READ a(i),b$(i): NEXT i
40 RESTORE 20: READ x,y$
50 DEF FN f(n)=n*n
60 DEF FN g$(s$)=s$(2 TO )
70 LET z=FN f(a(3)): LET c$=FN g$(b$(2))
80 OPEN #4,"s": PRINT #4;z;c$: CLOSE #4
90 IF z<>36 OR c$<>"wo     " OR x<>2 OR y$<>"one" THEN PRINT "CORE FAIL": STOP
100 PRINT "CORE OK"
