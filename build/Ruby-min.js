/* JSRuby - Ruby for Javascript
 *
 *  (c)2007 Nakatani Shuyo / Cybozu Labs, Inc.
 *  JSRuby is freely distributable under the terms of an MIT-style license.
 **/

//// toSource() for IE/Opera /////////////////////////////////////////
if(navigator.userAgent.indexOf("Gecko/")<0){
	Object.prototype.toSource = function(){
	  var ret="({";
		for(var name in this) {
			if (ret.length>2) ret+=",";
			ret += name+":";
			if (this[name]!=null) { ret += this[name].toSource(); } else { ret += "null"; }
		}
		return ret+"})";
	}
	Array.prototype.toSource = function(){
		var ret="[";
		for(var i=0;i<this.length;i++) {
			if (i!=0) ret+=",";
			if (this[i]!=null) { ret += this[i].toSource(); } else { ret += "null"; }
		}
		return ret+"]";
	}
	String.prototype.toSource = function(){return '"'+this+'"';}
	Number.prototype.toSource = Number.prototype.toString;
	Boolean.prototype.toSource = Boolean.prototype.toString;
}


//// Reserved Words & Operators //////////////////////////////////////

var RubyEngine = {}
RubyEngine.FIREFOX = navigator.userAgent.indexOf("Gecko/")>=0;
RubyEngine.OPERA = navigator.userAgent.indexOf("Opera")>=0;
RubyEngine.IE = navigator.userAgent.indexOf("MSIE")>=0;
RubyEngine.SAFARI = navigator.userAgent.indexOf("Safari")>=0;

RubyEngine.RESERVED = {
  "if":true, "then":true, "elsif":true, "else":true, "end":true,
  "while":true, "unless":true, "until":true, "def":true, "eval":false, 
  "nil":true
}
RubyEngine.OPERATORS = {
	"::":1,
	"[]":2,
	//"+":10, "!":10, "~":10, // '+' is a monomial.
	"**":11,
	//"-":12, // arithmetic negation
	"*":13, "/":13, "%":13,
	"+":14, "-":14,
	"<<":15, ">>":15,
	"&":20,
	"|":21, "^":21,
	">":22, ">=":22, "<":22, "<=":22,
	"<=>":23, "==":23, "===":23, "!=":23, "=~":23, "!~":23,
	"&&":24,
	"||":25,
	"..":30, "...":30,
	"?:":31, // Conditional Operator
	"=": 32, //(+=, -= ... )
	"not": 40,
	"and":41, "or":41
}




;
//// Node ////////////////////////////////////////////////////////////

RubyEngine.Node = {}

RubyEngine.Node.Variable = function(name){
	this.type = "V";
	this.name = name;
}
RubyEngine.Node.Variable.prototype.toSource = function(){return this.type+"'"+this.name+"'"}

RubyEngine.Node.Ref = function(name){
	this.type = "R";
	this.name = name;
}
RubyEngine.Node.Ref.prototype.toSource = function(){return this.type+"'"+this.name+"'"}

RubyEngine.Node.Operator = function(name){
	this.type = "O";
	this.name = name;
}
RubyEngine.Node.Operator.prototype.toSource = function(){return this.type+"'"+this.name+"'"}

RubyEngine.Node.Method = function(name, target, args){
	this.type = "M";
	this.name = name;
	this.target = target;
	if(name=="eval" && target==null) this.name = "*eval"; // for Object#eval
	this.args = args;
	this.block = undefined;
}
RubyEngine.Node.Method.prototype.toSource = function(){
  var block = this.block?this.block.toSource():"";
  return this.type+"("+(this.target==null?"":this.target.toSource()+".")+this.name+","+(this.args?this.args.toSource():this.args)+")" + block;
}
RubyEngine.Node.Method.prototype.clone = function(){
  var args=[];
  if(this.args) for(var i=0;i<this.args.length;i++) args.push(this.args[i]);
  return new RubyEngine.Node.Method(this.name,this.target,args);
}

RubyEngine.Node.Block = function(vars, block){
	this.type = "B";
	this.vars = vars
	this.block = block;
}
RubyEngine.Node.Block.prototype.toSource = function(){
  return "{|"+(this.vars?this.vars.toSource():this.target)+"| "+(this.block?this.block.toSource():this.block)+"}"
}

RubyEngine.Node.Expression = function(list){
	this.type = "E";
	var polishlist = [];
	var ope = [];
	for(var idx=0;idx<list.length;idx++) {
		var x = list[idx];
		if (RubyEngine.Node.Operator.prototype.isPrototypeOf(x)) {
			while (ope.length>0) {
				if (RubyEngine.OPERATORS[ope[0].name] > RubyEngine.OPERATORS[x.name]) break;
				polishlist.push(ope.shift());
			}
			ope.unshift(x);
		} else {
			polishlist.push(x);
		}
	}
	while(ope.length>0) {
		polishlist.push(ope.shift());
	}
	this.list = polishlist;
}
RubyEngine.Node.Expression.prototype.toSource = function(){return this.type+"'"+this.list.toSource()+"'"}


;
//// RubyObject //////////////////////////////////////////////////////


RubyEngine.RubyObject = {
  inherit: function(s, c) {
    c.prototype = new s();
    c.clz = {};
    c.methods = {}
    c.superclz = s;
    return c;
  },
  call: function(self, name, args, block){
    var clz = self.clz;
    var method;
    while( !(method=clz.methods[name]) ) if ( !(clz=clz.superclz) ) break;
    if (method) {
      return method.apply(this, [self, args, block]);
    } else if (name!="method_missing") {
      var newarg = [new RubyEngine.RubyObject.String(name)];
      if (args && args.length > 0) newarg = newarg.concat(args);
      var ret = RubyEngine.RubyObject.call.apply(this, [self, "method_missing", newarg, block]);
      if (ret!=undefined) return ret;
      return new RubyEngine.RubyObject.NameError("undefined local variable or method `"+name+"' for "+self.clz.toString(), name);
    }
    return undefined;
  },
  js2r: function(obj){
    if (obj==undefined) return obj;
    if (obj==null) return obj; // TODO:
    var clzname = Object.prototype.toString.call(obj);
    if (clzname == "[object String]") {                 // string
      return new RubyEngine.RubyObject.String(obj);
    } else if (clzname == "[object Array]"){            // array
      var ary = []
      for (var i=0;i<obj.length;i++) ary.push(RubyEngine.RubyObject.js2r(obj[i]));
      var ret = new RubyEngine.RubyObject.Array();
      ret.array = ary;
      return ret;
      return new RubyEngine.RubyObject.Array(ary);
    } else if (clzname == "[object Number]") {          // number
      return new RubyEngine.RubyObject.Numeric(obj);
    } else if (clzname == "[object Boolean]") {         // TODO: boolean
      return obj;
    } else {                                            // others
      return new RubyEngine.RubyObject.JSObject(obj);
    }
  }
}

RubyEngine.RubyObject.Object = function(){ this.clz = RubyEngine.RubyObject.Object; }
RubyEngine.RubyObject.Object.prototype.toValue = function(){ return this; } // to Javascript value(instance)


RubyEngine.RubyObject.Object.clz = { "methods":{} }
RubyEngine.RubyObject.Object.methods = {
 inspect: function(self, args){ return self.toString(); },
 dup: function(self, args){ return self; } // TODO:
}


RubyEngine.RubyObject.Numeric = RubyEngine.RubyObject.inherit(RubyEngine.RubyObject.Object ,function(){
  this.toValue = function(){ return this.num; }
  this.clz = RubyEngine.RubyObject.Numeric;
  this.num = 0;
  if (arguments.length>0) this.num = arguments[0];
});
//RubyEngine.RubyObject.Numeric.prototype.toValue = function(){ return this.num; }
RubyEngine.RubyObject.Numeric.prototype = {
  toString: function(){ return this.num.toString(); },
  toSource: function(){ return this.num.toString(); },
  neg: function(){ return new RubyEngine.RubyObject.Numeric(-this.num); },
  add: function(x){ return new RubyEngine.RubyObject.Numeric(this.num + x.num); },
  sub: function(x){ return new RubyEngine.RubyObject.Numeric(this.num - x.num); },
  mul: function(x){ return new RubyEngine.RubyObject.Numeric(this.num * x.num); },
  div: function(x){ return new RubyEngine.RubyObject.Numeric(parseInt(this.num / x.num)); },
  mod: function(x){ return new RubyEngine.RubyObject.Numeric(this.num % x.num); },
  pow: function(x){ return new RubyEngine.RubyObject.Numeric(Math.pow(this.num, x.num)); },
  eql: function(x){ return this.num == x.num; },
  cmp: function(x){ return (this.num==x.num?0:(this.num<x.num?-1:1)); }
}
RubyEngine.RubyObject.Numeric.methods = {
  "chr": function(self, args, block) {
    return new RubyEngine.RubyObject.String( String.fromCharCode(self.num) );
  },
  "to_s": function(self, args, block) {
    return new RubyEngine.RubyObject.String( String(self.num) );
  },
  "upto": function(self, args, block) {
    if (!block) return null;
    var varname, to=this.run(args[0]).num;
    this.run(args[0], function(res){
      var to = res.num;
      if (block.vars) varname = block.vars[0].name;
      this.scope.pushLevel();
      for(var i=self.num; i<=to; i++) {
    	  if (varname) this.scope.substitute(varname, new RubyEngine.RubyObject.Numeric(i));
    	  this.run(block.block, function(){});
      }
    });
    this.scope.popLevel();
    return self;
  }
};


RubyEngine.RubyObject.String = RubyEngine.RubyObject.inherit(RubyEngine.RubyObject.Object ,function(){
  this.toValue = function(){ return this.str; }
  this.clz = RubyEngine.RubyObject.String;
  this.str = "";
  if (arguments.length>0) this.str = arguments[0];
});
//RubyEngine.RubyObject.String.prototype.toValue = function(){ return this.str; }
RubyEngine.RubyObject.String.prototype.toString = function(){ return this.str; }
RubyEngine.RubyObject.String.prototype.toSource = function(){ return '"'+this.str+'"'; }
RubyEngine.RubyObject.String.prototype.add = function(x){ return new RubyEngine.RubyObject.String(this.str + x.str); }
RubyEngine.RubyObject.String.prototype.mul = function(x){
  var st="";
  for(var i=0;i<x.num;i++) st+=this.str;
  return new RubyEngine.RubyObject.String(st);
}
RubyEngine.RubyObject.String.prototype.eql = function(x){ return this.str == x.str; }
RubyEngine.RubyObject.String.methods = {
  "length": function(self, args, block) {
    return new RubyEngine.RubyObject.Numeric(self.str.length);
  },
  "reverse": function(self, args, block) {
    var st = "";
    for(var i=self.str.length-1;i>=0;i--) st += self.str.charAt(i);
    return new RubyEngine.RubyObject.String(st);
  },
  "center": function(self, args, block) {
    var len=this.run(args[0]).num;
    var st = "";
    for(var i=(len-self.str.length-1)/2;i>0;i--) st += " ";
    st += self.str;
    while(st.length<len) st += " ";
    return new RubyEngine.RubyObject.String(st);
  },
  "to_i": function(self, args, block) {
    var v = parseInt(self.str);
    if (isNaN(v)) v=0;
    return new RubyEngine.RubyObject.Numeric(v);
  },
  "[]": function(self, args, block) {
    return new RubyEngine.RubyObject.Numeric(self.str.charCodeAt(this.run(args[0]).num));
  },
  "[]=": function(self, args, block) {
    var x = this.run(args[0]).num;
    if (RubyEngine.RubyObject.Numeric.prototype.isPrototypeOf(args[1])) {
      self.str = self.str.substr(0,x) + String.fromCharCode(args[1].num) + self.str.substr(x+1);
      return args[1];
    } else {
      self.str = self.str.substr(0,x) + this.run(args[1]).toString() + self.str.substr(x+1);
      return args[1];
    }
  }
};


RubyEngine.RubyObject.Array = RubyEngine.RubyObject.inherit(RubyEngine.RubyObject.Object ,function(){
  this.toValue = function(){
    var ret = [];
    for(var i=0;i<this.array.length;i++) ret.push( this.array[i].toValue() );
    return ret;
  }
  this.clz = RubyEngine.RubyObject.Array;
  this.array = [];
});
RubyEngine.RubyObject.Array.toSource = function(){ return "Array"; }
RubyEngine.RubyObject.Array.prototype.toSource = function(){
  var ret = "[";
  for(var i=0;i<this.array.length;i++) {
    if (i>0) ret+=",";
    ret += this.array[i].toSource();
  }
  return ret + "]";
}
RubyEngine.RubyObject.Array.prototype.toString = function(){
  var ret = "[";
  for(var i=0;i<this.array.length;i++) {
    if (i>0) ret+=",";
    ret += this.array[i].toString();
  }
  return ret + "]";
}
RubyEngine.RubyObject.Array.prototype.sft = function(x){
  this.array.push(x);
  return this;
}
RubyEngine.RubyObject.Array.clz.methods = {
  "new": function(self, args, block) {
    var obj = new RubyEngine.RubyObject.Array();
    var ary = [];
    if (args) for(var i=0;i<args.length;i++) ary.push(this.run(args[i]));
    obj.array = ary;
    return obj;
  }
}
RubyEngine.RubyObject.Array.methods = {
  "[]": function(self, args, block) {
    return self.array[this.run(args[0]).num];
  },
  "push": function(self, args, block) {
    if(args){
      for(var i=0;i<args.length;i++) self.array.push(this.run(args[i]));
    }
    return self;
  },
  "[]=": function(self, args, block) {
    return self.array[this.run(args[0]).num] = this.run(args[1]);
  },
  "length": function(self, args, block) {
    return new RubyEngine.RubyObject.Numeric(self.array.length);
  },
  "member?": function(self, args, block) {
    var x=this.run(args[0]);
    for(var i=0;i<self.array.length;i++) {
      if (x.eql(self.array[i])) return true;
    }
    return false;
  },
  "reverse": function(self, args, block) {
    var ret = new RubyEngine.RubyObject.Array();
    ret.array = self.array.reverse;
    return ret;
  },
  "each": function(self, args, block) {
    if (!block) return null;
    var varname;
    if (block.vars) varname = block.vars[0].name; // TODO: multiple variables
    this.scope.pushLevel();
    for(var i=0;i<self.array.length;i++) {
    	if (varname) this.scope.substitute(varname, self.array[i]);
    	this.run(block.block);
    }
    this.scope.popLevel();
    return self;
  },
  "inject": function(self, args, block) {
    if (!block) return null;
    var i=0,r;
    if(args && args.length>0){
      r=this.run(args[0]);
    } else {
      r=self.array[i++];
    }
    while(i<self.array.length){
      var newargs = {};
      if (block.vars) {
        if (block.vars.length>0) newargs[block.vars[0].name] = r;
        if (block.vars.length>1) newargs[block.vars[1].name] = self.array[i++];
      }
      this.scope.pushLevel(newargs);
      r = this.run(block.block);
      this.scope.popLevel();
    }
    return r;
  },
  "join": function(self, args, block) {
    var st = "", sep = (args&&args.length>0?this.run(args[0]).str:""); // TODO: $,
    for(var i=0;i<self.array.length;i++) {
      if(i>0) st+=sep;
      st+=self.array[i].toString();
    }
    return new RubyEngine.RubyObject.String(st);
  }
};


RubyEngine.RubyObject.Range = RubyEngine.RubyObject.inherit(RubyEngine.RubyObject.Object ,function(from, to){
  this.clz = RubyEngine.RubyObject.Range;
  this.from = from;
  this.to = to;
});
RubyEngine.RubyObject.Range.prototype.toString = function(){ return "("+this.from+".."+this.to+")" }
RubyEngine.RubyObject.Range.prototype.toValue = function(){
  var value=[];
  for(var i=this.from;i<=this.to;i++) value.push(i);
  return value;
}
RubyEngine.RubyObject.Range.methods = {
 "each": function(self, args, block) {
  if (!block) return null;
  var varname;
  if (block.vars) varname = block.vars[0].name; // TODO: multiple variables
  this.scope.pushLevel();
  for(var i=self.from;i<=self.to;i++) {
  	if (varname) this.scope.substitute(varname, new RubyEngine.RubyObject.Numeric(i));
  	this.run(block.block);
  }
  this.scope.popLevel();
  return self;
 }
}


RubyEngine.RubyObject.JSObject = RubyEngine.RubyObject.inherit(RubyEngine.RubyObject.Object ,function(obj){
  this.obj = obj;
  this.clz = RubyEngine.RubyObject.JSObject;
});
RubyEngine.RubyObject.JSObject.prototype.toString = function(){ return this.obj.toString(); }
RubyEngine.RubyObject.JSObject.prototype.toValue = function(){ return this.obj; }
RubyEngine.RubyObject.JSObject.methods = {
  "new": function(self, args, block) {
    var jsargs = [];
    if(args) for(var i=0;i<args.length;i++) jsargs.push("this.run(args["+i+"]).toValue()");
    return RubyEngine.RubyObject.js2r(eval( "new self.obj("+jsargs.join(',')+")" ));
  },
  "[]": function(self, args, block) {
    return RubyEngine.RubyObject.js2r(self.obj[this.run(args[0]).num]);
  },
  "each": function(self, args, block) {
    if (!block) return null;
    var varname;
    if (block.vars) varname = block.vars[0].name; // TODO: multiple variables
    this.scope.pushLevel();
    for(var i=0;i<self.obj.length;i++) {
    	if (varname) this.scope.substitute(varname, RubyEngine.RubyObject.js2r(self.obj[i]));
    	this.run(block.block);
    }
    this.scope.popLevel();
    return self;
  },
  "method_missing": function(self, args, block) {
    var name = this.run(args[0]).str;
    if (args.length==1) {
      return RubyEngine.RubyObject.js2r(self.obj[name]);
    } else if (name.charAt(name.length-1) == "=") {
      var v=this.run(args[1])
      self.obj[name.slice(0, name.length-1)] = v.toValue();
      return v;
    } else {
      if (name in self.obj) {
        if (RubyEngine.FIREFOX || RubyEngine.OPERA) { // Firefox, Opera
          var jsargs = [];
          for (var i=1;i<args.length;i++) jsargs.push( this.run(args[i]).toValue() );
          return RubyEngine.RubyObject.js2r(self.obj[name].apply(self.obj, jsargs));
        } else { // others
          var jsargs = [];
          for (var i=1;i<args.length;i++) jsargs.push( "this.run(args["+i+"]).toValue()" );
          return RubyEngine.RubyObject.js2r( eval( "self.obj[name]("+jsargs.join(',')+")" ));
        }
      } else {
        return new RubyEngine.RubyObject.NameError("undefined local variable or method `"+name+"' for "+self.obj.toString(), name);
      }
    }
 }
}



//// Exception ///////////////////////////////////////////////////////

RubyEngine.RubyObject.Exception = RubyEngine.RubyObject.inherit(RubyEngine.RubyObject.Object,function(){});
RubyEngine.RubyObject.Exception.prototype.toString = function(){ return this.message; }
RubyEngine.RubyObject.Exception.prototype.toSource = function(){ return this.message; }

RubyEngine.RubyObject.StandardError = RubyEngine.RubyObject.inherit(RubyEngine.RubyObject.Exception,function(){});
RubyEngine.RubyObject.NameError = RubyEngine.RubyObject.inherit(RubyEngine.RubyObject.StandardError,function(){
  this.toValue = function(){ return this; }
  if (arguments.length>0) this.message = arguments[0];
  if (arguments.length>1) this.name = arguments[1];
});

;

//// Parser //////////////////////////////////////////////////////////

RubyEngine.Parser = function(){}
RubyEngine.Parser.prototype.isfull = function(){ return this.body.match(/^\s*$/) }
RubyEngine.Parser.prototype.parse = function(body) {
	this.body = body;
	return this.compstmt();
}

//  CompStmt: Stmt (Term+ Stmt)*
RubyEngine.Parser.prototype.compstmt = function() {
	var x;
	while(this.term());
	if ((x=this.stmt())==undefined) return undefined;
	var ret = [x];
	var prebody = this.body;
	while (this.term()) {
		while(this.term());
		if (!(x=this.stmt())) break;
		prebody = this.body;
		ret.push(x);
	}
	this.body = prebody;
	return ret;
}

//  Stmt: Expr (if Expr|unless Expr|while Expr)*
RubyEngine.Parser.prototype.stmt = function() {
	var x, y;
	if ((x=this.expr())==undefined) return undefined;
	var ret = [x]
	while (this.body.match(/^[ \t]*(if|unless|while|until)/)) {
		var prebody = this.body;
		this.body = RegExp.rightContext;
		x = RegExp.$1;
		if (!(y=this.expr())) {
			this.body = prebody;
			break;
		}
		ret.unshift(y);
		ret = new RubyEngine.Node.Method(x, null, ret);
	}
	return ret;
}

//  Expr: Command | Arg 
RubyEngine.Parser.prototype.expr = function() {
	var x;
	if ((x=this.command())!=undefined) return x;
	if ((x=this.arg())!=undefined) return x;
	return undefined;
}


//  Command: Operation Args
RubyEngine.Parser.prototype.command = function() {
	var x, y;
	var prebody = this.body;
	if (x=this.operation()) {
		if (this.body.match(/^[ \t]+[^\-\+]|^[ \t]*"/) && (y=this.args())) return new RubyEngine.Node.Method(x, null, y);
		this.body=prebody;
	}
	return undefined;
}

//  Lhs : VarName | Primary '[' Args ']' | Primary . IDENTIFIER
RubyEngine.Parser.prototype.lhs = function() {
  var x;
  var prebody = this.body;
  if ((x=this.primary())!=undefined) {
    if (RubyEngine.Node.Method.prototype.isPrototypeOf(x) && x.block==undefined && (x.name=="[]" || x.args==undefined || x.args.length==0)) return x;
    this.body = prebody;
  }
  if ((x=this.varname())!=undefined) return x;
  return undefined;
}

//  Args: Arg ([,] Arg)*
RubyEngine.Parser.prototype.args = function() {
	var x, y;
	if ((x=this.arg())==undefined) return undefined;
	var ret = [x];
	var prebody = this.body;
	while ((x=this.comma()) && (y=this.arg())) {
		prebody = this.body;
		ret.push(y);
	}
	this.body = prebody;
	return ret;
}

// Arg: Lhs ('=' | Operator'=') Arg | Primary (Operator Primary)*
RubyEngine.Parser.prototype.arg = function() {
	var x, y, z;
	var prebody = this.body;
	if (x=this.lhs()) {
		if (this.body.match(/^[ \t]*(\+|\-|\*|\/)?\=/)) {
      z = RegExp.$1;
			this.body = RegExp.rightContext;
			if ((y=this.arg())!=undefined) {
        if (z) y = new RubyEngine.Node.Expression([x, new RubyEngine.Node.Operator(z), y]);
        if (RubyEngine.Node.Method.prototype.isPrototypeOf(x)) {
          x = x.clone();
          x.name += "=";
          if (x.args) { x.args.push(y); } else { x.args = [y]; }
          return x;
        } else {
          return new RubyEngine.Node.Method("*let", null, [x, y]);
        }
      }
    }
		this.body=prebody;
	}

	if ((x=this.primary())!=undefined) {
		var ret = [x];
		prebody = this.body;
		while ((x=this.operator()) && ((y=this.primary())!=undefined)) {
			prebody = this.body;
			ret.push(x, y);
		}
		this.body = prebody;
		if (ret.length==1) return ret[0];
		return new RubyEngine.Node.Expression(ret);
	}
	return undefined;
}

RubyEngine.Parser.prototype.blockvars = function() {
	var x, ret=[];
	var prebody = this.body;
	if (this.body.match(/^[ \t]*(\|)/)) {
		this.body = RegExp.rightContext;
		while ((x = this.varname()) && this.body.match(/^[ \t]*(,|\|)/)) {
      ret.push(x);
			this.body = RegExp.rightContext;
			if (RegExp.$1=="|") return ret;
		}
		this.body = prebody;
	}
	return undefined;
}

// Primary : ('-'|'+') Primary 
//      | Primary2 ( '['Args']' | '.'Operation ('('Args')')? (('{'|'do') ('|'Varname'|')? CompStmt ('}'|'end'))? )* Args?
RubyEngine.Parser.prototype.primary = function() {
	if (this.body.match(/^[ \t]*([-+])/)) {
    var x = RegExp.$1, y;
    var prebody = this.body;
		this.body = RegExp.rightContext;
  	if ((y=this.primary())!=undefined) {
      if (x=='+') return y;
  		return new RubyEngine.Node.Expression([new RubyEngine.Node.Operator('-@'), y]);
    }
		this.body = prebody;
  }

	var prim = this.primary2();
  while(prim != undefined) {
    var y=undefined, z=null, sep=undefined;
    var prebody = this.body;

		if (this.body.match(/^[ \t]*(\.|\[)/)) {
      this.body = RegExp.rightContext;
      sep = RegExp.$1;
    }
    // '[' Args ']'
    if (sep=='[') {
      y = this.args();
      if (y==undefined || !this.body.match(/^[ \t]*\]/)) {
        this.body = prebody;
        break;
      }
  		this.body = RegExp.rightContext;
  		prim = new RubyEngine.Node.Method('[]', prim, y);
      continue;
    }

    // '.'Operation
    if (sep=='.' && (y=this.operation()) == undefined ) {
		  this.body = prebody;
		  break;
		}

    // ('(' Args ')')?
		if (this.body.match(/^[ \t]*(\()/)) {
			prebody = this.body;
			this.body = RegExp.rightContext;
			if (((z = this.args())!=undefined) && this.body.match(/^[ \t]*(\))/)) {
				this.body = RegExp.rightContext;
      } else {
				this.body = prebody;
				z = null;
			}
    }
    if (y!=undefined) {
      prim = new RubyEngine.Node.Method(y, prim, z);
    } else if (sep==undefined && z!=null && RubyEngine.Node.Ref.prototype.isPrototypeOf(prim)) {
      prim = new RubyEngine.Node.Method(prim.name, null, z);
    } else {
		  this.body = prebody;
		  break;
    }

    // ('{' ('|'Varname'|')? CompStmt '}')?
		if (this.body.match(/^[ \t]*(\{|do)/)) {
      var br=RegExp.$1;
			prebody = this.body;
			this.body = RegExp.rightContext;
			y=this.blockvars();  // it is maybe 'undefined'
      z=this.compstmt();
      if (z==undefined) z=null;
			if ((br=="{" && this.body.match(/^\s*\}/)) || this.body.match(/^\s*end/)) {
				this.body = RegExp.rightContext;
				prim.block = new RubyEngine.Node.Block(y, z);
			} else {
    		this.body = prebody;
    	}
    }
	}

  // Args ( but only Method without arguments and block )
  var y;
  if (RubyEngine.Node.Method.prototype.isPrototypeOf(prim) && prim.args==null && prim.block==undefined && this.body.match(/^[ \t]*[^ \t\-\+]/) && (y=this.args())!=undefined) prim.args = y;
  return prim;
}

//  Primary2: '(' Stmt ')' | Literal | Reference | '[' Args ']'
//        | if Arg Then CompStmt (elsif Arg Then CompStmt)* (else CompStmt)? end
//        | def Operation ArgDecl CompStmt end
//  Literal: / $INT | StrLiteral /,
RubyEngine.Parser.prototype.primary2 = function() {
//console.log(this.body);console.trace();if(!confirm("continue?"))exit();
	var x, y, z;
	var prebody = this.body;
	if (this.body.match(/^[ \t]*(\()/)) {
		this.body = RegExp.rightContext;
		if ((x = this.stmt()) && this.body.match(/^[ \t]*(\))/)) {
			this.body = RegExp.rightContext;
			return x;
		}
		this.body = prebody;
	}

	if (this.body.match(/^[ \t]*(-?0x[0-9A-F]+|(-?)0b([01]+)|-?0o?[0-7]+|-?(?:0d)?[0-9]+)/i)) {
		this.body = RegExp.rightContext;
    var i;
    if (RegExp.$3) {
		  i = parseInt(RegExp.$3, 2);
      if (RegExp.$2) {
        i = -i;
      }
    } else {
      i = RegExp.$1.replace(/0d/i, '').replace(/0o/i, '0');
      if (RubyEngine.OPERA && i.match(/^0[0-7]+$/)) {
        i = parseInt(i, 8);
      } else {
        i = parseInt(i);
      }
    }
		return new RubyEngine.RubyObject.Numeric(i);
  } else if (this.body.match(/^[ \t]*\?(.)/)) { // ?a
		this.body = RegExp.rightContext;
		return new RubyEngine.RubyObject.Numeric(RegExp.$1.charCodeAt(0));
	} else if ((x=this.strLiteral())!=undefined) {
		return x;
	} else if ((x=this.reference())!=undefined) {
		return new RubyEngine.Node.Ref(x);
	}

  // '[' Args ']'
	if (this.body.match(/^[ \t]*\[/)) {
		this.body = RegExp.rightContext;
    x = this.args();
    if (this.body.match(/^[ \t]*\]/)) {
  		this.body = RegExp.rightContext;
      return new RubyEngine.Node.Method("new", RubyEngine.RubyObject.Array, x);
    }
    this.body = prebody;
  }

  // if Arg Then CompStmt (elsif Arg Then CompStmt)* (else CompStmt)? end
	if (this.body.match(/^[ \t]*(if)/)) {
		this.body = RegExp.rightContext;
		x = RegExp.$1;
		if ((y = this.arg())!=undefined && this.then()) {
			if (z=this.compstmt()) {
			  var args = [y, z];
				while (this.body.match(/^[ \s]*(elsif)/)) {
					var prebody2 = this.body;
					this.body = RegExp.rightContext;
					if ((y = this.arg()) && this.then()) {
						if (!(z=this.compstmt())) { this.body = prebody2; break; }
						args.push(y, z)
					}
				}
				if (this.body.match(/^[ \s]*(else)/)) {
					var prebody2 = this.body;
					this.body = RegExp.rightContext;
					if (z=this.compstmt()) { 
						args.push(true, z)
					} else {
						this.body = prebody2
					}
				}
				if (this.body.match(/^[ \s]*(end)/)) {
					this.body = RegExp.rightContext;
					return new RubyEngine.Node.Method(x, null, args);
				}
			}
		}
		this.body = prebody;
	}

  // def Fname ArgDecl CompStmt end
	if (this.body.match(/^[ \t]*def/)) {
		this.body=RegExp.rightContext;
		x=this.operation();
		y=this.argdecl();
		z=this.compstmt();
  	while(this.term());
		if(x!=undefined && z!=undefined && this.body.match(/^[ \s]*(end)/)) {
			this.body = RegExp.rightContext;
  		ret = new RubyEngine.Node.Method("def", null, [new RubyEngine.RubyObject.String(x)]);
  		ret.block = new RubyEngine.Node.Block(y, z);
  		return ret;
    }
		this.body = prebody;
	}

	return undefined;
}

// StrLiteral : '[^']*' | "( [^"]*? #{ CompStmt } )* [^"]*?"
RubyEngine.Parser.prototype.strLiteral = function() {
  var prebody = this.body;
	if (this.body.match(/^[ \t]*'((?:[^\\']|\\.)*)'/)) {
    this.body=RegExp.rightContext;
    return new RubyEngine.RubyObject.String(RegExp.$1);
  } else if (this.body.match(/^[ \t]*"/)) { //"
    this.body=RegExp.rightContext;
    var ret = [], x;
    while (this.body.match(/^((?:[^\\"]|\\.)*?)#\{/)) { //"
      this.body=RegExp.rightContext;
      if ((x=RegExp.$1)!="") ret.push(new RubyEngine.RubyObject.String(x));
      if ((x=this.compstmt())==undefined || !this.body.match(/^\s*}/)) {
        this.body=prebody;
        return undefined;
      }
      this.body=RegExp.rightContext;
      ret.push(x);
    }
    if (this.body.match(/^((?:[^\\"]|\\.)*?)"/)) {
      this.body=RegExp.rightContext;
      if ((x=RegExp.$1)!="") ret.push(new RubyEngine.RubyObject.String(x));
      if (ret.length==1 && RubyEngine.RubyObject.String.prototype.isPrototypeOf(ret[0])) {
        return ret[0];
      } else {
        return new RubyEngine.Node.Method("*concat", null, ret);
      }
    }
  }
  this.body=prebody;
  return undefined;
}

// ArgDecl : `(' ArgList `)' | ArgList Term
RubyEngine.Parser.prototype.argdecl = function() {
  var x;
	var prebody = this.body;
	if (this.body.match(/^[ \t]*\(/)) {
    this.body=RegExp.rightContext;
    if ((x=this.arglist())!=undefined && this.body.match(/^[ \t]*\)/) ) {
      this.body=RegExp.rightContext;
      return x;
    }
  } else {
    if ((x=this.arglist())!=undefined && this.term() ) return x;
  }
  this.body=prebody;
	return undefined;
}

// ArgList : varname(`,'varname)*[`,'`*'[varname]][`,'`&'varname] | `*'varname[`,'`&'varname] | [`&'varname]
RubyEngine.Parser.prototype.arglist = function() {
  var x;
  if ((x=this.varname())==undefined) return [];
  var ret=[x], prebody=this.body;
  while (this.body.match(/^[ \t]*,/)) {
    this.body=RegExp.rightContext;
    if ((x=this.varname())==undefined) break;
    ret.push(x);
    prebody=this.body;
  }
  this.body=prebody;
  return ret;
}

RubyEngine.Parser.prototype.then = function() {
	if (this.body.match(/^\s*(then)/)) {
	  this.body = RegExp.rightContext;
	  return "then"
  }
	return this.term();
}

RubyEngine.Parser.prototype.varname = function() {
	if (this.body.match(/^[ \t]*([A-Za-z_\$][A-Za-z0-9_]*)/) && !RubyEngine.RESERVED[RegExp.$1]) {
		this.body = RegExp.rightContext;
		return new RubyEngine.Node.Variable(RegExp.$1);
	}
}


//////////////////////////////////////////////////////////////////////

RubyEngine.Parser.prototype.term = function() {
	if (this.body.match(/^[ \t]*(\r?\n|;)/)) {
		this.body = RegExp.rightContext;
		return RegExp.$1
	}
	return undefined;
}
RubyEngine.Parser.prototype.comma = function() {
	if (this.body.match(/^[ \t]*,/)) {
		this.body = RegExp.rightContext;
		return ",";
	}
	return undefined;
}

RubyEngine.Parser.prototype.operator = function() {
	if (this.body.match(/^[ \t]*(\.\.|\+|\-|\*{1,2}|\/|%|==|<<|>>|[<>]=?|&&|\|\|)/)) {
		this.body = RegExp.rightContext;
		return new RubyEngine.Node.Operator(RegExp.$1);
	}
	return undefined;
}

RubyEngine.Parser.prototype.reference = function() {
	if (this.body.match(/^[ \t]*([A-Za-z_\$][A-Za-z0-9_]*[\!\?]?)/) && !RubyEngine.RESERVED[RegExp.$1]) {
		this.body = RegExp.rightContext;
		return RegExp.$1;
	}
	return undefined;
}

// Operation: $IDENTIFIER('!'|'?')?
RubyEngine.Parser.prototype.operation = function() {
	if (this.body.match(/^[ \t]*([A-Za-z_][A-Za-z0-9_]*[\!\?]?)/) && !RubyEngine.RESERVED[RegExp.$1]) {
		this.body = RegExp.rightContext;
		return RegExp.$1;
	}
	return undefined;
}



;
//// Interpreter /////////////////////////////////////////////////////

RubyEngine.Scope = function(){ this.clear(); }
RubyEngine.Scope.prototype = {
  pushScope: function(args){ this.stack.push(this.level); this.level=[args || {}]; },
  popScope: function(){ this.level = this.stack.pop(); },
  pushLevel: function(args){ this.level.push(args || {}); },
  popLevel: function(){ this.level.pop(); },
  clear: function(){
    this.level = [{}];
    this.stack = [];
    this.global = {};
    if (typeof(window)!='undefined') this.global={"$window": new RubyEngine.RubyObject.JSObject(window), "$document": new RubyEngine.RubyObject.JSObject(document) };
    for(var i in RubyEngine.Interpreter.KernelMethod) {
      if (i.match(/^[a-z_\*]/)) this.global[i] = RubyEngine.Interpreter.KernelMethod[i];
    }
    for(var i in RubyEngine.RubyObject) {
      if (i.match(/^[A-Z\$]/)) this.global[i] = RubyEngine.RubyObject[i];
    }
  },
  globalsubstitute: function(name, value){
    return this.global[name] = value;
  },
  substitute: function(name, value){
    if (name.match(/^\$/)) {
        return this.global[name] = value;
    } else if (name.match(/^[A-Z]/)) {
      if (name in this.global) { /* "warning: already initialized constant "+name */ }
      return this.global[name] = value;
    } else {
      for(var i=this.level.length-1;i>=0;i--) {
        if (name in this.level[i]) return this.level[i][name] = value;
      }
      return this.level[this.level.length-1][name] = value;
    }
  },
  reference: function(name){
    for(var i=this.level.length-1;i>=0;i--) {
      if (name in this.level[i]) return this.level[i][name];
    }
    if (name in this.global) return this.global[name];
    return new RubyEngine.RubyObject.NameError("undefined local variable or method `"+name+"'", name);
  },
  call: function(name, args, block, refflag, callback) {
    var ref = this.scope.reference(name);
    if (typeof(ref) == "function") {
      return ref.apply(this, [args, block, callback]);
    } else if (RubyEngine.RubyObject.JSObject.prototype.isPrototypeOf(ref)) {
      var jsargs = [];
      if(args) this.runArray(args, function(res){
         RubyEngine.RubyObject.js2r(ref.obj.apply(ref.obj, jsargs));
      });
    } else if (RubyEngine.Node.Block.prototype.isPrototypeOf(ref)) {
      var block = ref;
      var newargs = {};
      var that = this;
      if (block.vars) {
        this.runArray(args, function(res){
          for (var i=0; i < res.length; i++)
            newargs[block.vars[i].name] = res[i]; 
        });
      }
     that.scope.pushScope(newargs);
      var ret = this.run(block.block, function(res){
        that.scope.popScope();
        callback(res);
      });
    } else if (refflag) {
      callback(ref);
    } else {
      callback(new RubyEngine.RubyObject.NameError("undefined local variable or method `"+node.name+"'", node.name));
    }
  }
}

RubyEngine.Interpreter = function(){
  this.context = {};
	this.scope = new RubyEngine.Scope();
	this.stdout = "";
	this.parser = new RubyEngine.Parser();
}
RubyEngine.Interpreter.prototype = {
  writeStdout: function(st){
    
  },

  exec: function(node, callback){
    if (typeof(node)=="string") node = this.parser.parse(node);
    var ret = this.run(node, callback);
    if (typeof(ret)=="object" && "toValue" in ret) return ret.toValue();
    return ret;
  },
  
  runArray: function(arr, callback){
    var result = arr;
    var eval_index = 0;
    if (result.length > 0) {
      var that = this;
      var evalElement = function(elem) {
        result[eval_index++] = elem;
        if (eval_index == result.length) {
          callback(elem);
        } else {
          that.run(result[eval_index], evalElement);
        }
      };
      this.run(result[eval_index], evalElement);
    } else {
      callback();
    }
  },
  run: function(node, callback){
//console.log(node.toSource());console.trace();if(!confirm("continue?")) exit();
  	if (Array.prototype.isPrototypeOf(node)) {
      this.runArray(node, callback);

  	} else if (RubyEngine.Node.Variable.prototype.isPrototypeOf(node)) {
  		callback(this.scope.reference(node.name));

  	} else if (RubyEngine.Node.Expression.prototype.isPrototypeOf(node)) {
  		this.calcExpr(node, callback);

  	} else if (RubyEngine.Node.Method.prototype.isPrototypeOf(node) || RubyEngine.Node.Ref.prototype.isPrototypeOf(node)) {
      var t = node.type;
  		if (t=="M" && node.target!=null) {
  			ret = this.objectMethod(node, callback);
  		} else {
        this.scope.call.apply(this, [node.name, node.args, node.block, (t=="R"), callback]);
      }
  	} else {
  		 callback(node);
  	}
  },
  calcExpr: function(node, callback){
  	var calclist = node.list;
  	var stk = [];
    var that = this;
    var stkPush = function(x, sync){
      // the node is static and should be treated syncro
      if (sync) {
        stk.push(x);
        calc()
      } else {
        // the node should be ran first
        that.run(x, function(res){
          stk.push(res);
          calc()
        });
      }
    };
    var ct = 0;
    function calc(){
      var x = calclist[ct++];
      if (ct > calclist.length) {
        return callback(stk.pop());
      }
  		if (Array.prototype.isPrototypeOf(x)) {
        stkPush(x);
  		} else if (RubyEngine.Node.Expression.prototype.isPrototypeOf(x)) {
  			calcExpr(x, function(res){
  			  stkPush(res, true);
  			});
  		} else if (RubyEngine.Node.Variable.prototype.isPrototypeOf(x)) {
  			stkPush(this.scope.reference(x.name), true);
  		} else if (RubyEngine.Node.Ref.prototype.isPrototypeOf(x)) {
  			stkPush(x);
  		} else if (RubyEngine.Node.Method.prototype.isPrototypeOf(x)) {
  			stkPush(x);
  		} else if (RubyEngine.Node.Operator.prototype.isPrototypeOf(x)) {
  			switch (x.name) {
  			case "-@":
  				stkPush(stk.pop().neg(), true);
  				break;
  			case "+":
  				var a = stk.pop();
  				stkPush(stk.pop().add(a), true);
  				break;
  			case "-":
  				var a = stk.pop();
  				stkPush(stk.pop().sub(a), true);
  				break;
  			case "*":
  				var a = stk.pop();
  				stkPush(stk.pop().mul(a), true);
  				break;
  			case "/":
  				var a = stk.pop();
  				stkPush(stk.pop().div(a), true);
  				break;
  			case "%":
  				var a = stk.pop();
  				stkPush(stk.pop().mod(a), true);
  				break;
  			case "**":
  				var a = stk.pop();
  				stkPush(stk.pop().pow(a), true);
  				break;
  			case "..":
  				var to = stk.pop();
  				var from = stk.pop();
          stkPush(new RubyEngine.RubyObject.Range(from.num, to.num), true);
  				break;
  			case "==":
  				var a = stk.pop();
  				stkPush(stk.pop().eql(a), true);
  				break;
  			case "<":
  				var a = stk.pop();
  				stkPush(stk.pop().cmp(a)<0, true);
  				break;
  			case ">":
  				var a = stk.pop();
  				stkPush(stk.pop().cmp(a)>0, true);
  				break;
  			case ">=":
  				var a = stk.pop();
  				stkPush(stk.pop().cmp(a)>=0, true);
  				break;
  			case "<<":
  				var a = stk.pop();
  				stkPush(stk.pop().sft(a), true);
  				break;
  			}
  		} else {
  			stkPush(x, true);
  		}
    }
    calc();
  },

  call: function(name, args){
    var newargs=[];
    for(var i=0;i<args.length;i++) newargs.push(RubyEngine.RubyObject.js2r(args[i]));
    return this.scope.call.apply(this, [name, newargs, null, true]).toValue();
  },
  put: function(name, value){
    this.scope.globalsubstitute(name, RubyEngine.RubyObject.js2r(value));
  },

  kernelMethod: function(node){
    var method = this.scope.reference(node.name);
    if (typeof(method)=="function") {
      return method.apply(this, [node.args, node.block]);
    } else {
  		alert("undefined method: " + node.name);
  	}
  },
  objectMethod: function(node, callback){
//console.log(node.toSource());console.dir(node);console.trace();if(!confirm("continue?")) exit();
    var obj;
    if (RubyEngine.Node.Ref.prototype.isPrototypeOf(node.target)) {
      callback(this.scope.reference(node.target.name));
    } else {
      this.run(node.target, callback);
    }
  }
}

;
//// KernelMethods ///////////////////////////////////////////////////

// 'this' is the interpreter instance.

RubyEngine.Interpreter.KernelMethod = {
  "def": function(args, block, callback) {
    var name = args[0].str;
    this.scope.globalsubstitute(name, block);
    if (!(name in this)) {
      this[name] = function(){return this.call(name, arguments);};
    }
    callback();
  },
  "*eval": function(args) {
    var src = this.run(args[0]).str;
    var nodes = this.parser.parse(src);
    return this.run(nodes);
  },
  "puts": function(args, block, callback) {
    var that = this;
    if (args && args.length > 0) {
      this.runArray(args, function(res){
        for(var i = 0; i < args.length; i++)
          that.writeStdout(res);
      });
    } else {
      this.writeStdout("\n");
    }
    callback();
  },
  "if": function(args, block, callback) {
    var ctr = 0;
    var that = this;
    var condEval = function(elem){
      if (elem || elem===0 || elem==="")
       that.run(args[++ctr], callback);
      else{
        ctr+=2;
        that.run(args[ctr], condEval);
      }
    };
    this.run(args[ctr], condEval);
  },
  "*let": function(args, block, callback) {
    var that = this;
    this.run(args[1], function(res){
     callback(that.scope.substitute(args[0].name, res));
    });
  },
  "*concat": function(args) {
    var st="";
    if (args && args.length > 0) {
      for(var i=0;i<args.length;i++) st+=this.run(args[i]).toString();
    }
    return new RubyEngine.RubyObject.String(st);
  },
  "p": function(args) {
    if (args && args.length > 0) {
      for (var i=0; i<args.length; i++) {
        this.writeStdout(this.run(args[i]).toSource() + "\n");
      }
    }
  }
};



;
//// Util ////////////////////////////////////////////////////////////

RubyEngine.Util = {
  getRubyScriptList: function(){
    var ret = []
    var ary = document.getElementsByTagName("script");
    for(var i=0; i < ary.length; i++) {
    	if(ary[i].type == "text/ruby") ret.push(ary[i]);
    }
    return ret;
  },
  getRubyScript: function(){
    var t="",list=this.getRubyScriptList();
    for(var i=0; i < list.length; i++) t+=list[i].text;
    return t;
  }
}

