function BSAlert(type, msg, target, keep) {
	$("#bs-alert").remove();
	var title = $.i18n.prop(type);
	var elm = '<div id="bs-alert" style="z-index:999999;display:none;" class="alert alert-'+type+'">'
		+ '<a href="#" class="close" data-dismiss="alert">&times;</a>'
		+ '<strong>['+title+']</strong> '+msg+'</div>';

	if(target) {
		$(target).append(elm);
	} else {
		$('body').prepend(elm);
	}

	$("#bs-alert").slideDown(500, function() {
		$(this).alert();
	});
	if(!keep) {
		$("#bs-alert").delay(4000).slideUp(500, function() {
			$(this).alert('close');
		});
	}
}

function showAlert(msg) {
	$('#alertModalBody').html(msg);
	$('#alertModel').modal('show');
}

function hideAlert() {
	$('#alertModel').modal('hide');
}

_.templateSettings = {
	interpolate : /\{\{(.+?)\}\}/g
};

$(function() {
	$('body').tooltip({ selector: '[data-toggle=tooltip]' });
});

$(function() {
	var path = document.location.pathname;
	var arr = path.split('/');
	if(arr) {
		var cls = arr[1];
		if (cls.length) {
			$('.gnb-' + cls).addClass('active');
		} else {
			$('.gnb-projects').addClass('active');
		}
	} else {
		$('.gnb-projects').addClass('active');
	}
});

