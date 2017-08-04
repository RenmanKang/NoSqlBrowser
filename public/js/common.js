String.prototype.trim = function() {
	return this.replace(/(^\s*)|(\s*$)/gi, '');
};

String.prototype.endsWith = function(suffix) {
	return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

String.prototype.endsWith = function(suffix) {
	return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

(function( window, undefined ) {
	var JSComm = {
		isEmpty : function(str) {
			return !(str && str.trim().length > 0);
		},

		trim : function(str) {
			return str.trim();
		},

		getKeyCode : function(e) {
			var event = (e) ? e : window.event;
			return (event.charCode) ? event.charCode : ((event.which) ? event.which : event.keyCode);
		},

		getByteLength : function(str) {
			var ch = null;
			var len = 0;
			for(var i = 0 ; i < str.length ; i++) {
				ch = encodeURIComponent(str.charAt(i));
				if(ch.length == 1 || ch.length == 3)  // %xx
					len++;
				else // if(ch.length == 6) // %uxxxx
					len += 2;
			}
			return len;
		},

		getCookieVal : function(offset) {
			var endstr = document.cookie.indexOf(';', offset);
			if(endstr == -1) {
				endstr = document.cookie.length;
			}
			return decodeURIComponent(document.cookie.substring(offset, endstr));
		},

		getCookie : function(name) {
			var arg = name + '=';
			var alen = arg.length;
			var clen = document.cookie.length;
			var i = 0;

			while(i < clen) {
				var j = i + alen;
				if(document.cookie.substring(i, j) == arg)
					return JSComm.getCookieVal(j);
				i = document.cookie.indexOf(' ', i) + 1;
				if(i == 0)
					break;
			}
			return null;
		},

		setCookie : function(name, value, exdays, path, domain, secure) {
			var expires;
			if(exdays) {
				var d = new Date();
				d.setTime(d.getTime() + (exdays*24*60*60*1000));
				expires = d.toUTCString();
			}

			document.cookie = name + '=' + encodeURIComponent(value)
				+ (expires ? ('; expires=' + expires) : '')
				+ (path ? ('; path=' + path) : '')
				+ (domain ? ('; domain=' + domain) : '')
				+ (secure ? '; secure' : '');
		},

		selectOption : function( s, v ) {
			var l = s.options.length;
			var ret = false;
			for (var i=0; i < l; i++){
				if (s.options[i].value==v){
					s.options[i].selected = true;
					ret = true;
				} else {
					s.options[i].selected = false;
				}
			}
			return ret;
		},

		tabOrder : function(len, cur, next) {
			if($('#'+cur).val().length == len) {
				$('#'+next).focus();
			}
		},

		isNumber : function(val) {
			if(!val) return false;

			var c;
			for(var i = 0; i < val.length; i++) {
				c = val.charAt(i);
				if(c < '0' || c > '9') return false;
			}
			return true;
		},

		log : function(s) {
			if (window.console && window.console.log) {
				window.console.log(s);
			}
		}
	};

	window.JSComm = JSComm;
})(window);

