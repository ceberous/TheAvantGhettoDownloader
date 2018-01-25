const cliselect = require( "list-selector-cli" );
const GetDownloadablePlaylists = require( "./UTILS/generic.js" ).getDownloadablePlaylists;
const GetPlaylistMetaInfo = require( "./UTILS/generic.js" ).getPlaylistMetaInfo;
const DownloadMP3 = require( "./UTILS/generic.js" ).downloadAGMP3;
const SliceMedia = require( "./UTILS/generic.js" ).sliceMedia;
const fs = require( "fs" );
const path = require( "path" );

( async ()=> {

	// 1.) Get Downloadable Playlists	
	var wPlaylists = await GetDownloadablePlaylists();

	// 2.) Select One to Download
	var wChoices = wPlaylists.map( x => x[ "playlistURL" ] );
	var wChoice = new cliselect( wChoices );
	var wSelected = await wChoice.prompt();
	var wActive =  wPlaylists.filter( x => wSelected.indexOf( x[ "playlistURL" ] ) !== -1 );
	wActive = wActive[ 0 ];
	console.log( wActive );

	// 3.) Get Playlist Meta Stuff
	var wMetaInfo = await GetPlaylistMetaInfo( wActive[ "playlistURL" ] );
	console.log( wMetaInfo );
	const showID = wActive[ "showID" ];
	const jsonData = { "show_id": show_id , items: wMetaInfo  };
	fs.writeFileSync( path.join( __dirname , ( showID + ".json" ) ) , JSON.stringify( jsonData ) );

	// 3.) Download It
	await DownloadMP3( wActive[ "mp3URL" ] , showID );
	
	// 4.) Split and Tag It
	for ( var i = 0; i < wMetaInfo.length; ++i ) {
		console.log( "Slicing [ " + ( i + 1 ).toString() + " ] of " + wMetaInfo.length.toString() );
		await SliceMedia( showID , wMetaInfo[ i ] );
	}

})();