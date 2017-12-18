const path = require( "path" );
const request = require( "request" );
const cheerio = require( "cheerio" );
const FeedParser = require( "feedparser" );
const download = require( "download-to-file" );
// const id3 = require( "id3-writer" );
// const writer = new id3.Writer();
// https://stackoverflow.com/questions/44910333/how-to-build-wget-progress-bar-in-node-js-for-downloading-files
require( "shelljs/global" );

// function GET_DURATION( wFilePath ) {
// 	try {
// 		var z1 = "ffprobe -v error -show_format -i " + wFilePath;
// 		var x1 = exec( z1 , { silent: true , async: false } );
// 		if ( x1.stderr ) { return( x1.stderr ); }
// 		var wMatched = x1.stdout.match( /duration="?(\d*\.\d*)"?/ );
// 		var f1 = Math.floor( wMatched[1] );
// 		return f1;
// 	}
// 	catch( e ) { console.log( e ); return 0; }
// }

function fixPathSpace( wFP ) {
	var fixSpace = new RegExp( " " , "g" );
	wFP = wFP.replace( fixSpace , String.fromCharCode(92) + " " );
	wFP = wFP.replace(/[^A-Za-z 0-9 \.,\?""!@#\$%\^&\*\(\)-_=\+;:<>\/\\\|\}\{\[\]`~]*/g, '')
	wFP = wFP.replace( ")" , "" );
	wFP = wFP.replace( "(" , "" );
	wFP = wFP.replace( "'" , String.fromCharCode(92) + "'" );
	wFP = wFP.replace( ">" , "" );
	wFP = wFP.replace( "<" , "" );
	return wFP;
}

// function WRITE_ID3_TAG( wPath , wMetaOBJ ) {
// 	return new Promise( function( resolve , reject ) {
// 		try {
// 			console.log( "writing to --> " + wPath );
// 			var file = new id3.File( wPath );
// 			var meta = new id3.Meta({
// 			    artist: wMetaOBJ[ "artist" ],
// 			    title: wMetaOBJ[ "track" ] ,
// 			    album: wMetaOBJ[ "album" ]
// 			});
			 
// 			writer.setFile( file ).write( meta , function(err) {
// 			    if (err) { console.log( err ); reject( err ); return; }
// 			});
// 			console.log( "Wrote ID3 Tag !!" );
// 			resolve();
// 		}
// 		catch( error ) { console.log( error ); reject( error ); }
// 	});
// }

function SLICE_MEDIA( wShowID , wMetaOBJ ) {
	return new Promise( async function( resolve , reject ) {
		try {

			var wPath = path.join( __dirname , ".." , ( wShowID + ".mp3" ) );
			var z1 = "ffmpeg -i " + wPath + " -ss " + wMetaOBJ[ "startTime" ];
			if ( wMetaOBJ[ "endTime" ] !== "" ) {
				z1 =  z1 + " -t " + wMetaOBJ[ "endTime" ];
			}

			z1 = z1 + " -async 1 -c copy " + fixPathSpace( wMetaOBJ[ "track" ] ) + ".mp3";
			console.log( z1 );

			var x1 = exec( z1 , { silent: true , async: false } );
			if ( x1.stderr ) { resolve( x1.stderr ); return; }
			console.log( "sliced !!" );

			// var wNewPath =  path.join( __dirname , ".." , wMetaOBJ[ "track" ] + ".mp3" );
			// console.log( wNewPath );
			//await WRITE_ID3_TAG( wNewPath , wMetaOBJ );

			resolve();
		}
		catch( error ) { console.log( error ); resolve( error ); }
	});
}
module.exports.sliceMedia = SLICE_MEDIA;

function MAKE_REQUEST( wURL ) {
	return new Promise( async function( resolve , reject ) {
		try {
			var finalBody = null;
			function _m_request() {
				return new Promise( function( resolve , reject ) {
					try {
						request( wURL , async function ( err , response , body ) {
							if ( err ) { resolve("error"); return; }
							console.log( wURL + "\n\t--> RESPONSE_CODE = " + response.statusCode.toString() );
							if ( response.statusCode !== 200 ) {
								console.log( "bad status code ... " );
								resolve( "error" );
								return;
							}
							else {
								finalBody = body;
								resolve();
								return;
							}
						});
					}
					catch( error ) { console.log( error ); reject( error ); }
				});
			}

			var wRetry_Count = 3;
			var wSuccess = false;
			while( !wSuccess ) {
				if ( wRetry_Count < 0 ) { wSuccess = true; }
				var xSuccess = await _m_request();
				if ( xSuccess !== "error" ) { wSuccess = true; }
				else {
					wRetry_Count = wRetry_Count - 1;
					await W_SLEEP( 2000 );
					console.log( "retrying" );
				}
			}
			resolve( finalBody );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.makeRequest = MAKE_REQUEST;


function TRY_XML_FEED_REQUEST( wURL ) {
	return new Promise( function( resolve , reject ) {
		try {

			var wResults = [];
			var feedparser = new FeedParser( [{ "normalize": true , "feedurl": wURL }] );
			feedparser.on( "error" , function( error ) { console.log( error ); reject( error ); } );
			feedparser.on( "readable" , function () {
				var stream = this; 
				var item;
				while ( item = stream.read() ) { wResults.push( item ); }
			});

			feedparser.on( "end" , function() {
				resolve( wResults );
			});

			var wReq = request( wURL );
			wReq.on( "error" , function( error ) { console.log( error ); resolve( error ); });
			wReq.on( "response" , function( res ){
				var stream = this;
				if ( res.statusCode !== 200) { console.log( "bad status code" ); resolve("null"); return; }
				else { stream.pipe( feedparser ); }
			});

		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
function FETCH_XML_FEED( wURL ) {
	return new Promise( async function( resolve , reject ) {
		try {

			console.log( "Searching --> " + wURL );
			var wResults = [];

			var RETRY_COUNT = 3;
			var SUCCESS = false;

			while ( !SUCCESS ) {
				if ( RETRY_COUNT < 0 ) { SUCCESS = true; }
				wResults = await TRY_XML_FEED_REQUEST( wURL );
				if ( wResults !== "null" ) { SUCCESS = true; }
				else { 
					console.log( "retrying again" );
					RETRY_COUNT = RETRY_COUNT - 1;
					await wSleep( 2000 );
				}
			}
			resolve( wResults );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.fetchXMLFeed = FETCH_XML_FEED;

const WFMU_AVANT_GHETTO_PLAYLIST_FEED = "http://www.wfmu.org/playlistfeed/AH.xml";
function FETCH_AVANT_GHETTO_PLAYLIST_XML() {
	return new Promise( async function( resolve , reject ) {
		try {
			var wResults = await FETCH_XML_FEED( WFMU_AVANT_GHETTO_PLAYLIST_FEED );
			if ( wResults ) {
				if ( wResults.length > 0 ) {
					wResults = wResults.map( x => x[ "link" ] );
				}
			}
			resolve( wResults );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});s
}
module.exports.fetchAvantGhettoPlaylistXML = FETCH_AVANT_GHETTO_PLAYLIST_XML;


const WFMU_AVANT_GHETTO_MP3_FEED = "http://www.wfmu.org/archivefeed/mp3/AH.xml";
function FETCH_AVANT_GHETTO_MP3_ARCHIVE_XML() {
	return new Promise( async function( resolve , reject ) {
		try {
			var wResults = await FETCH_XML_FEED( WFMU_AVANT_GHETTO_MP3_FEED );
			if ( wResults ) {
				if ( wResults.length > 0 ) {
					wResults = wResults.map( x => x[ "link" ] );
				}
			}
			resolve( wResults );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});s
}
module.exports.fetchAvantGhettoMP3ArchiveXML = FETCH_AVANT_GHETTO_MP3_ARCHIVE_XML;

const BASE_PLAYLIST_URL = "http://www.wfmu.org/playlists/shows/";
function GET_DOWNLOADABLE_PLAYLISTS() {
	return new Promise( async function( resolve , reject ) {
		try {

			var wPlaylistsLinks = await FETCH_AVANT_GHETTO_PLAYLIST_XML();
			var wPlaylistShowIDS = wPlaylistsLinks.map( x => x.substring( ( x.length - 5 ) , x.length ) );

			var wMP3ArchiveLinks = await FETCH_AVANT_GHETTO_MP3_ARCHIVE_XML();
			var wMP3ShowIDS = wMP3ArchiveLinks.map( x => x.substring( ( x.length - 5 ) , x.length ) );

			var wMatchingLinks = wPlaylistShowIDS.filter( x => wMP3ShowIDS.indexOf( x ) !== -1 );

			var wFinalResults = [];
			for ( var i = 0; i < wMatchingLinks.length; ++i ) {
				for ( var j = 0; j < wMP3ArchiveLinks.length; ++j ) {
					if ( wMP3ArchiveLinks[ i ].substring( ( wMP3ArchiveLinks[ i ].length - 5 ) , wMP3ArchiveLinks[ i ].length ) === wMatchingLinks[ i ] ) {
						wFinalResults.push( { mp3URL: wMP3ArchiveLinks[ i ] , playlistURL: BASE_PLAYLIST_URL + wMatchingLinks[ i ] , showID: wMatchingLinks[ i ] } );
						break;
					}
				}
			}
			
			resolve( wFinalResults );

		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.getDownloadablePlaylists = GET_DOWNLOADABLE_PLAYLISTS;

function GET_AVANT_GHETTO_PLAYLIST_META( wURL ) {
	return new Promise( async function( resolve , reject ) {
		try {

			var wBody = await MAKE_REQUEST( wURL );
			try { var $ = cheerio.load( wBody ); }
			catch( err ) { resolve( "cheerio load failed" ); return; }

			var wSongs = [];
			$( ".song" ).each( function() {
				var a1 = $( this ).text();
				if ( a1 ) {
					a1 = a1.toString();
					a1 = a1.replace( /\n|\r/g , "" );
					a1 = a1.trim();
				}
				wSongs.push( a1 );
			});

			var wFinalResults = [];
			if ( wSongs[ 0 ] === "Artist" && wSongs[ 4 ] === "Approx. start time" ) {
				var wINDX = 5;
				while ( wINDX < ( wSongs.length ) ) {
					if ( wSongs[ wINDX ] === "" ) { wINDX = wINDX + 1; }
					else {
						var wTrack = wSongs[ wINDX + 1 ];
						wFinalResults.push({
							artist: wSongs[ wINDX ] ,
							track: wTrack ,
							album: wSongs[ wINDX + 2 ] ,
							label: wSongs[ wINDX + 3 ] ,
							startTime: wSongs[ wINDX + 4 ].split( " " )[0] ,
							endTime: "" 
						});
						wINDX = wINDX + 5;
					}
				}
			}
			else if ( wSongs[ 0 ] === "Artist" && wSongs[ 5 ] === "Approx. start time" ) {
				var wINDX = 6;
				while ( wINDX < ( wSongs.length ) ) {
					if ( wSongs[ wINDX ] === "" ) { wINDX = wINDX + 1; }
					else {
						var wTrack = wSongs[ wINDX + 1 ];
						wFinalResults.push({
							artist: wSongs[ wINDX ] ,
							track: wTrack ,
							album: wSongs[ wINDX + 2 ] ,
							label: wSongs[ wINDX + 3 ] ,
							startTime: wSongs[ wINDX + 5 ].split( " " )[0] ,
							endTime: "" 
						});
						wINDX = wINDX + 6;
					}
				}
			}

			for ( var i = 0; i < ( wFinalResults.length - 1 ); ++i ) {
				wFinalResults[ i ][ "endTime" ] = wFinalResults[ i + 1 ][ "startTime" ];
			}
			resolve( wFinalResults );
		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.getPlaylistMetaInfo = GET_AVANT_GHETTO_PLAYLIST_META;

function DOWNLOAD_FILE_AVANT_GHETTO_MP3( wURL , wShowID ) {
	return new Promise( async function( resolve , reject ) {
		try {

			var wMP3Link = await MAKE_REQUEST( wURL );
			console.log( wMP3Link );

			var wPath = path.join( __dirname , ".." , ( wShowID + ".mp3" ) );
			console.log( "Downloading To --> " + wPath );
			console.log( "sorry... no progress bar" );

			download( wMP3Link , wPath , function ( err , filepath ) {
				if (err) { reject( err ); return; }
				console.log( "Download finished:" , filepath )
				resolve();
			});

		}
		catch( error ) { console.log( error ); reject( error ); }
	});
}
module.exports.downloadAGMP3 = DOWNLOAD_FILE_AVANT_GHETTO_MP3;