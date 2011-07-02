(function() {
  var $, JSREPL, repl_logo;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  $ = jQuery;
  repl_logo = '\t   _       .---.  .--. .---. .-.\n\t  :_;      : .; :: .--\': .; :: :\n\t  .-. .--. :   .\': `;  :  _.\': :\n\t  : :`._-.\': :.`.: :__ : :   : :__\n\t  : :`.__.\':_;:_;`.__.\':_;   :___.\'\n\t.-. :         jsREPL v0.1\n\t`._.\' Amjad Masad & Max Shawabkeh';
  JSREPL = (function() {
    function JSREPL() {
      this.lang = null;
      this.engine = null;
      this.examples = null;
      this.jqconsole = null;
      this.sandbox_frame = null;
      this.sandbox = null;
      this.DefineTemplates();
      this.SetupConsole();
      this.LoadLanguageDropdown();
      this.SetupURLHashChange();
      this.jqconsole.Focus();
    }
    JSREPL.prototype.DefineTemplates = function() {
      $.template('optgroup', '{{each(cat, names_arr) data}}\n  <optgroup label="${cat}">\n    {{each names_arr}}\n      <option value="${$value.value}">\n        ${$value.display}\n      </option>\n    {{/each}}\n  </optgroup>\n{{/each}}');
      return $.template('option', '<option>${value}</option>');
    };
    JSREPL.prototype.SetupConsole = function() {
      return this.jqconsole = $('#console').jqconsole(repl_logo);
    };
    JSREPL.prototype.StartPrompt = function() {
      return this.jqconsole.Prompt(true, $.proxy(this.Evaluate, this), $.proxy(this.CheckLineEnd, this));
    };
    JSREPL.prototype.LoadLanguageDropdown = function() {
      var $languages, categories, lang_def, system_name, _ref;
      categories = {};
      _ref = JSREPL.prototype.Languages.prototype;
      for (system_name in _ref) {
        lang_def = _ref[system_name];
        if (!(categories[lang_def.category] != null)) {
          categories[lang_def.category] = [];
        }
        categories[lang_def.category].push({
          display: lang_def.name,
          value: system_name
        });
      }
      $languages = $('#languages');
      $languages.empty().append($.tmpl('optgroup', {
        data: categories
      }));
      $languages.change(__bind(function() {
        var lang;
        $('body').toggleClass('loading');
        lang = $languages.val();
        return this.LoadLanguage(lang, __bind(function() {
          $('body').toggleClass('loading');
          this.StartPrompt();
          return window.location.hash = lang.toLowerCase();
        }, this));
      }, this));
      return $languages.change();
    };
    JSREPL.prototype.LoadLanguage = function(lang_name, callback) {
      var close, i, lab_script, open, signalReady, signals_read, _i, _len, _ref, _ref2, _ref3;
      this.engine = null;
      if ((_ref = this.sandbox_frame) != null) {
        if (typeof _ref.remove === "function") {
          _ref.remove();
        }
      }
      this.jqconsole.Reset();
      this.jqconsole.RegisterShortcut('Z', __bind(function() {
        this.jqconsole.AbortPrompt();
        return this.StartPrompt();
      }, this));
      $('#examples').val('');
      this.sandbox_frame = $('<iframe/>', {
        src: 'sandbox.html',
        style: 'display: none'
      });
      this.sandbox_frame.appendTo('body');
      this.sandbox = this.sandbox_frame[0].contentWindow;
      this.lang = JSREPL.prototype.Languages.prototype[lang_name];
      i = 0;
      _ref2 = this.lang.matchings;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        _ref3 = _ref2[_i], open = _ref3[0], close = _ref3[1];
        this.jqconsole.RegisterMatching(open, close, 'matching-' + (++i));
      }
      signals_read = 0;
      signalReady = function() {
        if (++signals_read === 2) {
          return callback();
        }
      };
      lab_script = $('<script/>', {
        src: 'lib/LAB-1.2.0.js'
      });
      lab_script.bind('load', __bind(function() {
        var loader, script, _j, _len2, _ref4;
        this.sandbox.$LAB.setGlobalDefaults({
          UsePreloading: false,
          UseLocalXHR: false
        });
        loader = this.sandbox.$LAB;
        _ref4 = this.lang.scripts;
        for (_j = 0, _len2 = _ref4.length; _j < _len2; _j++) {
          script = _ref4[_j];
          loader = loader.script(script).wait();
        }
        return loader.wait(__bind(function() {
          return $LAB.script(this.lang.engine).wait(__bind(function() {
            return this.engine = new JSREPL.prototype.Engines.prototype[lang_name]($.proxy(this.ReceiveInputRequest, this), $.proxy(this.ReceiveOutput, this), $.proxy(this.ReceiveResult, this), $.proxy(this.ReceiveError, this), this.sandbox, signalReady);
          }, this));
        }, this));
      }, this));
      this.sandbox_frame.bind('load', __bind(function() {
        return this.sandbox.document.body.appendChild(lab_script[0]);
      }, this));
      $('#lang_logo').attr('src', this.lang.logo);
      return $.get(this.lang.example_file, __bind(function(raw_examples) {
        var $examples, code, example_parts, part, title, _j, _len2;
        this.examples = {};
        $examples = $('#examples');
        $(':not(:first)', $examples).remove();
        example_parts = raw_examples.split(/\*{80}/);
        title = null;
        for (_j = 0, _len2 = example_parts.length; _j < _len2; _j++) {
          part = example_parts[_j];
          part = part.replace(/^\s+|\s*$/g, '');
          if (!part) {
            continue;
          }
          if (title) {
            code = part;
            this.examples[title] = code;
            title = null;
          } else {
            title = part;
            $examples.append($.tmpl('option', {
              value: title
            }));
          }
        }
        $examples.change(__bind(function() {
          code = this.examples[$examples.val()];
          this.jqconsole.SetPromptText(code);
          return this.jqconsole.Focus();
        }, this));
        return signalReady();
      }, this));
    };
    JSREPL.prototype.SetupURLHashChange = function() {
      var $languages, proper_case_langs;
      proper_case_langs = {};
      $.each(Object.keys(JSREPL.prototype.Languages.prototype), function(i, lang) {
        return proper_case_langs[lang.toLowerCase()] = lang;
      });
      $languages = $('#languages');
      return $.hashchange(function(lang) {
        lang = proper_case_langs[lang.toLowerCase()];
        if (($languages.find("[value=" + lang + "]")).length) {
          $languages.val(lang);
          return $languages.change();
        }
      });
    };
    JSREPL.prototype.ReceiveResult = function(result) {
      if (result) {
        this.jqconsole.Write('==> ' + result, 'result');
      }
      return this.StartPrompt();
    };
    JSREPL.prototype.ReceiveError = function(error) {
      this.jqconsole.Write(String(error), 'error');
      return this.StartPrompt();
    };
    JSREPL.prototype.ReceiveOutput = function(output, cls) {
      this.jqconsole.Write(output, cls);
    };
    JSREPL.prototype.ReceiveInputRequest = function(callback) {
      this.jqconsole.Input(__bind(function(result) {
        try {
          return callback(result);
        } catch (e) {
          return this.ReceiveError(e);
        }
      }, this));
    };
    JSREPL.prototype.CheckLineEnd = function(command) {
      if (/\n\s*$/.test(command)) {
        return false;
      } else {
        return this.engine.GetNextLineIndent(command);
      }
    };
    JSREPL.prototype.Evaluate = function(command) {
      $('#examples').val('');
      if (command) {
        return this.engine.Eval(command);
      } else {
        return this.StartPrompt();
      }
    };
    return JSREPL;
  })();
  JSREPL.prototype.Languages = (function() {
    function Languages() {}
    return Languages;
  })();
  JSREPL.prototype.Engines = (function() {
    function Engines() {}
    return Engines;
  })();
  this.JSREPL = JSREPL;
  $(function() {
    $LAB.setGlobalDefaults({
      UsePreloading: false,
      UseLocalXHR: false
    });
    return this.REPL = new JSREPL;
  });
}).call(this);
