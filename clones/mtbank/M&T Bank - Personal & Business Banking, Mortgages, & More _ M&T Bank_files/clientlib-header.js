function findDisclosures() {
	var $numberedDisclosures = $( ".numbered-disclosures" );
	var $unnumberedDisclosures = $( ".unnumbered-disclosures" );
	var $disclosureTitle = $( ".disclosure-title" );
	var $disclosures = $( "div[data-disclosure-id]" );
	var disclosureKVP = {};
	var disclosureNumber = 1;

	// clear the disclosures
	$numberedDisclosures.html( "" );
	$unnumberedDisclosures.html( "" );

	//find all disclosure and add to map
	$disclosures.each( function () {
		var $this = $( this );
		var disclosureId = $this.data( "disclosure-id" );
		var disclosure = $this.html();
		disclosureKVP[ disclosureId ] = disclosure;
	} );

	//do the right thing with the the disclosure title based on the number of disclosures on the page
	switch ( Object.keys( disclosureKVP ).length ) {
		case 0:
			$disclosureTitle.html( "" );
			break;
		case 1:
			$disclosureTitle.html( "Disclosure:" );
			break;
		default:
			$disclosureTitle.html( "Disclosures:" );
	}

	var isVisible = function ( $disclosureElement ) {
		return ( $disclosuredElement.is( ":visible" ) || $disclosureElement.closest( ".disclosure.component" ).length > 0 );
	};

	//go over json object to update superscript and add to disclosure block
	for ( var id in disclosureKVP ) {
		var disclosure = disclosureKVP[ id ];
		var $disclosuredElement = $( "sup[data-disclosure-id=" + id + "]" );
		var $disclosureAria = $( ".disclosure-label" );
		var disclosureLabel = "Disclosure number, please reference additional details in the Disclosures section at the bottom of this page.";
		if ( isVisible( $disclosuredElement ) ) {
			var newDisclosure = $( "<li>", { "class": "disclosure-text" } );
			newDisclosure.html( disclosure );

			if ( $disclosuredElement.hasClass( "numbered" ) ) {
				$disclosuredElement.html( disclosureNumber );
				$disclosureAria.addClass( "_visuallyhidden" ).text( disclosureLabel );
				disclosureNumber += 1;

				$numberedDisclosures.append( newDisclosure );
			} else {
				$unnumberedDisclosures.append( newDisclosure );
			}
		}
	}
}

// run the function if the content rendered failed or succeeded
$( document ).on( "at-content-rendering-succeeded at-content-rendering-failed run-disclosure", function () {
	findDisclosures();
} );

// run the function once the document is ready
$( document ).ready( function () {
	findDisclosures();
} );
