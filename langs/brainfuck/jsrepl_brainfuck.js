(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  this.JSREPL.prototype.Engines.prototype.Brainfuck = (function() {
    function Brainfuck(input, output, result, error, sandbox, ready) {
      this.result = result;
      this.error = error;
      this.sandbox = sandbox;
      this.sandbox.BF.init(output, input);
      ready();
    }
    Brainfuck.prototype.Eval = function(command) {
      try {
        if (command === "SHOWTAPE") {
          return this.result(this.sandbox.BF.getTape());
        } else {
          return this.sandbox.BF.parse(command, __bind(function(tape) {
            var after, before, cells, index, lower;
            cells = tape.split(/\s/);
            index = null;
            cells.forEach(function(cell, i) {
              if (/\[/.test(cell)) {
                return index = i;
              }
            });
            lower = index < 10 ? 0 : index - 10;
            before = cells.slice(lower, index);
            after = cells.slice(index + 1, index + 10);
            return this.result(before.concat([cells[index]]).concat(after).join(' '));
          }, this));
        }
      } catch (e) {
        return this.error(e);
      }
    };
    Brainfuck.prototype.GetNextLineIndent = function(command) {
      var brackets, char, _i, _len;
      if (/\[$/.test(command)) {
        return 1;
      }
      brackets = 0;
      for (_i = 0, _len = command.length; _i < _len; _i++) {
        char = command[_i];
        switch (char) {
          case '[':
            ++brackets;
            break;
          case ']':
            --brackets;
        }
      }
      return brackets || false;
    };
    return Brainfuck;
  })();
}).call(this);
