if @openDatabaseSync?
  db = @openDatabaseSync 'replit_input', '1.0', "Emscripted interpreters' input.", 1024
  @prompt = ->
    ret = 'xxx'
    t = null
    Sandboss.dbInput()
    db.transaction (tx) -> t = tx
    while not (res = t.executeSql('SELECT * FROM input').rows).length
      for i in [1...10000]
        for j in [1...10000]
          1
    
    cb = t.executeSql('DELETE FROM input')
    setTimeout cb, 150
    
    return res.item(0).text
