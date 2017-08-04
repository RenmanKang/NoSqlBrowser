i18n.setKeys({
	"General.Elasticsearch": "Elasticsearch",
	"General.LoadingFacets": "Loading Facets...",
	"General.Searching": "검색중...",
	"General.Search": "검색",
	"General.Help": "도움말",
	"General.HelpGlyph": "?",
	"General.CloseGlyph": "X",
	"General.RefreshResults": "갱신",
	"General.ManualRefresh": "수동 갱신",
	"General.RefreshQuickly": "빠른 갱신",
	"General.Refresh5seconds": "5초 마다 갱신",
	"General.Refresh1minute": "1분 마다 갱신",
	"AliasForm.AliasName": "별명",
	"AliasForm.NewAliasForIndex": "{0}의 새로운 별명",
	"AliasForm.DeleteAliasMessage": "type ''{0}'' to delete {1}. There is no undo",
	"AnyRequest.DisplayOptions" : "디스플레이 옵션",
	"AnyRequest.AsGraph" : "그래프 출력",
	"AnyRequest.AsJson" : "JSON 보기",
	"AnyRequest.AsTable" : "검색 결과 테이블 보기",
	"AnyRequest.History" : "이력",
	"AnyRequest.RepeatRequest" : "요청 반복",
	"AnyRequest.RepeatRequestSelect" : "Repeat request every ",
	"AnyRequest.Transformer" : "Result Transformer",
	"AnyRequest.Pretty": "Pretty",
	"AnyRequest.Query" : "Query",
	"AnyRequest.Request": "Request",
	"AnyRequest.Requesting": "Requesting...",
	"AnyRequest.ValidateJSON": "Validate JSON",
	"Browser.Title": "탐색기",
	"Browser.ResultSourcePanelTitle": "Result Source",
	"Command.DELETE": "DELETE",
	"Command.SHUTDOWN": "SHUTDOWN",
	"Command.DeleteAliasMessage": "Delete Alias?",
	"ClusterOverView.IndexName": "인덱스 명",
	"ClusterOverview.NumShards": "샤드 수",
	"ClusterOverview.NumReplicas": "리플리카 수",
	"ClusterOverview.NewIndex": "신규 인덱스",
	"IndexActionsMenu.Title": "명령",
	"IndexActionsMenu.NewAlias": "New Alias...",
	"IndexActionsMenu.Refresh": "갱신",
	"IndexActionsMenu.Flush": "Flush",
	"IndexActionsMenu.Optimize": "최적화...",
	"IndexActionsMenu.Snapshot": "Gateway Snapshot",
	"IndexActionsMenu.Analyser": "Test Analyser",
	"IndexActionsMenu.Open": "열기",
	"IndexActionsMenu.Close": "닫기",
	"IndexActionsMenu.Delete": "삭제...",
	"IndexInfoMenu.Title": "정보",
	"IndexInfoMenu.Status": "인덱스 상태",
	"IndexInfoMenu.Metadata": "인덱스 메타정보",
	"IndexCommand.TextToAnalyze": "Text to Analyse",
	"IndexCommand.ShutdownMessage": "type ''{0}'' to shutdown {1}. Node can NOT be restarted from this interface",
	"IndexOverview.PageTitle": "인덱스 개요",
	"IndexSelector.NameWithDocs": "{0} ({1} docs)",
	"IndexSelector.SearchIndexForDocs": "Search {0} for documents where:",
	"FilterBrowser.OutputType": "출력 방식: {0}",
	"FilterBrowser.OutputSize": " 출력 건수: {0}",
	"Header.ClusterHealth": "cluster health: {0} ({1} of {2})",
	"Header.ClusterNotConnected": "cluster health: 연결 안됨",
	"Header.Connect": "연결하기",
	"Nav.AnyRequest": "루신 쿼리",
	"Nav.Browser": "탐색기",
	"Nav.ClusterHealth": "Cluster Health",
	"Nav.ClusterState": "클러스터 상태",
	"Nav.ClusterNodes": "클러스터 노드",
	"Nav.Info": "정보",
	"Nav.NodeStats": "노드 통계",
	"Nav.Overview": "개요",
	"Nav.Indices": "인덱스",
	"Nav.Plugins": "플러그인",
	"Nav.Status": "상태",
	"Nav.Templates": "템플릿",
	"Nav.StructuredQuery": "조건 검색",
	"NodeActionsMenu.Title": "명령",
	"NodeActionsMenu.Shutdown": "Shutdown...",
	"NodeInfoMenu.Title": "정보",
	"NodeInfoMenu.ClusterNodeInfo": "클러스터 노드 정보",
	"NodeInfoMenu.NodeStats": "노드 통계",
	"NodeType.Client": "클러스터 노드",
	"NodeType.Coord": "코디네이터",
	"NodeType.Master": "마스터 노드",
	"NodeType.Tribe": "Tribe Node",
	"NodeType.Worker": "워커 노드",
	"NodeType.Unassigned": "Unassigned",
	"OptimizeForm.OptimizeIndex": "Optimize {0}",
	"OptimizeForm.MaxSegments": "Maximum # Of Segments",
	"OptimizeForm.ExpungeDeletes": "Only Expunge Deletes",
	"OptimizeForm.FlushAfter": "Flush After Optimize",
	"OptimizeForm.WaitForMerge": "머지 대기 중",
	"Overview.PageTitle" : "클러스터 개요",
	"Output.JSON": "JSON",
	"Output.Table": "Table",
	"Output.CSV": "CSV",
	"Output.ShowSource": "쿼리 소스 보기",
	"Preference.SortCluster": "클러스터 정렬",
	"Sort.ByName": "이름 순",
	"Sort.ByAddress": "주소 순",
	"Sort.ByType": "타입 순",
	"TableResults.Summary": "Searched {0} of {1} shards. {2} hits. {3} seconds",
	"QueryFilter.AllIndices": "전체 인덱스",
	"QueryFilter.AnyValue": "any",
	"QueryFilter-Header-Indices": "인텍스",
	"QueryFilter-Header-Types": "타입",
	"QueryFilter-Header-Fields": "필드",
	"QueryFilter.DateRangeHint.from": "From : {0}",
	"QueryFilter.DateRangeHint.to": "  To : {0}",
	"Query.FailAndUndo": "검색 실패. 마지막 변경점으로 되돌림",
	"StructuredQuery.ShowRawJson": "JSON 보기"
});

i18n.setKeys({
	"AnyRequest.TransformerHelp" : "\
		<p>The Result Transformer can be used to post process the raw json results from a request into a more useful format.</p>\
		<p>The transformer should contain the body of a javascript function. The return value from the function becomes the new value passed to the json printer</p>\
		<p>Example:<br>\
		  <code>return root.hits.hits[0];</code> would traverse a result set to show just the first match<br>\
		  <code>return Object.keys(root.nodes).reduce(function(tot, node) { return tot + root.nodes[node].os.mem.used_in_bytes; }, 0);</code> would return the total memory used across an entire cluster<br></p>\
		<p>The following functions are available and can be useful processing arrays and objects<br>\
		<ul>\
			<li><i>Object.keys</i>(object) := array</li>\
			<li>array.<i>forEach</i>(function(prop, index))</li>\
			<li>array.<i>map</i>(function(prop, index)) := array</li>\
			<li>array.<i>reduce</i>(function(accumulator, prop, index), initial_value) := final_value</li>\
		</ul>\
		<p>When Repeat Request is running, an extra parameter called prev is passed to the transformation function. This allows comparisons, and cumulative graphing</p>\
		<p>Example:<br>\
		<code>var la = [ root.nodes[Object.keys(root.nodes)[0]].os.load_average[0] ]; return prev ? la.concat(prev) : la;</code> would return the load average on the first cluster node over the last minute\
		This could be fed into the Graph to produce a load graph for the node\
		"
});

i18n.setKeys({
	"AnyRequest.DisplayOptionsHelp" : "\
		<p>Raw Json: shows complete results of the query and transformation in raw JSON format </p>\
		<p>Graph Results: To produce a graph of your results, use the result transformer to produce an array of values</p>\
		<p>Search Results Table: If your query is a search, you can display the results of the search in a table.</p>\
		"
});

i18n.setKeys({
	"QueryFilter.DateRangeHelp" : "\
		<p>Date fields accept a natural language query to produce a From and To date that form a range that the results are queried over.</p>\
		<p>The following formats are supported:</p>\
		<ul>\
			<li><b>Keywords / Key Phrases</b><br>\
				<code>now<br> today<br> tomorrow<br> yesterday<br> last / this / next + week / month / year</code><br>\
				searches for dates matching the keyword. <code>last year</code> would search all of last year.</li>\
			<li><b>Ranges</b><br>\
				<code>1000 secs<br> 5mins<br> 1day<br> 2days<br> 80d<br> 9 months<br> 2yrs</code> (spaces optional, many synonyms for range qualifiers)<br>\
				Create a search range centered on <code>now</code> extending into the past and future by the amount specified.</li>\
			<li><b>DateTime and Partial DateTime</b><br>\
				<code>2011<br> 2011-01<br> 2011-01-18<br> 2011-01-18 12<br> 2011-01-18 12:32<br> 2011-01-18 12:32:45</code><br>\
				these formats specify a specific date range. <code>2011</code> would search the whole of 2011, while <code>2011-01-18 12:32:45</code> would only search for results in that 1 second range</li>\
			<li><b>Time and Time Partials</b><br>\
				<code>12<br> 12:32<br> 12:32:45</code><br>\
				these formats search for a particular time during the current day. <code>12:32</code> would search that minute during today</li>\
			<li><b>Date Ranges</b><br>\
				<code>2010 -&gt; 2011<br> last week -&gt; next week<br> 2011-05 -&gt;<br> &lt; now</code><br>\
				A Date Range is created by specifying two dates in any format (Keyword / DateTime / Time) separated by &lt; or -&gt; (both do the same thing). If either end of the date range is missing, it is the same as having no constraint in that direction.</li>\
			<li><b>Date Range using Offset</b><br>\
				<code>2010 -> 1yr<br> 3mins < now</code>\
				Searches the specified date including the range in the direction specified.</li>\
			<li><b>Anchored Ranges</b><br>\
				<code>2010-05-13 05:13 <> 10m<br> now <> 1yr<br> lastweek <> 1month</code><br>\
				Similar to above except the range is extend in both directions from the anchor date</li>\
		</ul>\
	"
});
