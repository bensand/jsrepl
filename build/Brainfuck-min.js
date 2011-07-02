 BF = (function () {
  var bf = {};

  function assert(condition, message) {
    if (! condition) {
      throw message;
    }
  }
  
  function init(output_func, input_func){
    bf.output_func = output_func;
    bf.input_func = input_func;
  }

  function parse(code, callback) {
    bf.code = code.split(''); 
    bf.data = [];
    for (var i = 0; i < 40000; i++) {
      bf.data[i] = 0;
    }
    bf.max_d = bf.data.length;
    bf.max_i = bf.code.length;
    bf.output = [];
    bf.i_ptr = -1;
    bf.d_ptr = 0;
    bf.curr = '';
    bf.iteration = 0;
    bf.max_iterations = 100000;
    checkSyntax();
    bf.resultCallback = callback || function(){};
    getNextInstruction();
  }
  
  function movePtr(backwards){
    bf.iteration++;
    assert(bf.iteration < bf.max_iterations, "Maximum iteration limit hit");
    if (backwards) {
      bf.i_ptr--;
    }
    else {
      bf.i_ptr++;
    }
     bf.curr = bf.code[bf.i_ptr];
  }

  function getNextInstruction() {
    movePtr(); 
    if (!bf.curr){
      bf.resultCallback(" ");
      return;
    }
   switch (bf.curr) {
    case ',':
      readInput(getNextInstruction);
      break;
    case '.':
      writeOutput(getNextInstruction);
      break;
    case '+':
      incData(getNextInstruction);
      break;
    case '-':
      decData(getNextInstruction);
      break;
    case '>':
      incPointer(getNextInstruction);
      break;
    case '<':
      decPointer(getNextInstruction);
      break;
    case '[':
      openLoop(getNextInstruction);
      break;
    case ']':
      closeLoop(getNextInstruction);
      break;
    default:
      getNextInstruction();
    }

  }



  function openLoop(callback) {
    if (bf.data[bf.d_ptr]) {
      callback();
      return;
    }

    var counter = 0;
    while (true) {
      movePtr();
      if (bf.curr === '[') {
        counter++;
      }
      else if (bf.curr === ']') {
        counter--;
        if (counter === 0) {
          break;
        }
      }
    }
    callback();
  }

  function closeLoop(callback) {
    if (bf.data[bf.d_ptr] === 0) {
      callback();
      return
    }
    var counter = 1;
    while (true) {
      movePtr(true);
      assert(bf.i_ptr >= 0, "Mismatched brackets");
      if (bf.curr === ']') {
        counter++;
      }
      else if (bf.curr === '[') {
        counter--;
        if (counter === 0) {
          break;
        }
      }
    }
    callback();
  }

  function readInput(callback) {
    bf.input_func(function(input){
      var tmp;
      if (typeof input === "string")
      if (input === ""){
        bf.data[bf.d_ptr] = 10;
      }else{
        bf.data[bf.d_ptr] = input.charCodeAt(0);
      }
      callback();
    });
  }

  function writeOutput(callback) {
    bf.output_func(String.fromCharCode(bf.data[bf.d_ptr]));
    callback();
  }

  function incData(callback) {
    bf.data[bf.d_ptr]++;
    callback();
  }

  function decData(callback) {
    bf.data[bf.d_ptr]--;
    callback();
  }

  function incPointer(callback) {
    bf.d_ptr++;
    callback();
  }

  function decPointer(callback) {
    bf.d_ptr--;
    callback();
  }

  function checkSyntax() {
    var counter = 0;
    var c = '';
    for (var i = 0; i < bf.max_i; i++) {
      c = bf.code[i];
      if (c === '[') {
        counter++;
      }
      else if (c === ']') {
        counter--;
      }
    }
    assert(counter === 0, 'Mismatched brackets');
  }
  
  bf.init = init;
  bf.parse = parse;
  return bf;
})();




