if @openDatabaseSync?
  db = @openDatabaseSync 'emscripted_input', '1.0', "Emscripted interpreters' input.", 1024
  @prompt = ->
    ret = 'xxx'
    t = null
    Sandboss.dbInput()
    db.transaction (tx) -> t = tx
    while not (res = t.executeSql('SELECT text FROM input').rows).length
      1
    t.executeSql('DELETE FROM input')
    return res.item(0).text
