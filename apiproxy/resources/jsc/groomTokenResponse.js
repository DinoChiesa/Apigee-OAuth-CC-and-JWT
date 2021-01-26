// groomTokenResponse.js
// ------------------------------------------------------------------
//
// Tweaks the generated OAuth token response.
//
/* global response, context */

var b1 = JSON.parse(response.content),
    propertiesToRemove = [
      'status',
      'refresh_token_status',
      'token_type',
      'organization_name',
      'developer.email',
      'scope',
      'refresh_count',
      'api_product_list',
      'api_product_list_json',
      'application_name'],
    d;

function convertIssuedAt(prop) {
  if (b1[prop]) {
    var shortName = prop.substring(0, prop.length - 3);
    b1[prop] = parseInt(b1[prop], 10);
    var d = new Date(b1[prop]);
    b1[shortName] = d.toISOString();
  }
}

if (b1.access_token) {
  propertiesToRemove.forEach(function(item){
    delete b1[item];
  });

  // if there is no refresh token, which is the case for a
  // client_credentials token, don't keep properties related to it:
  if( ! b1.refresh_token ) {
    delete b1.refresh_token_expires_in;
    delete b1.refresh_count;
  }

  // convert *_issued_at to a number, and
  // add a property with an equivalent human-readable time strings.
  ['issued_at', 'refresh_token_issued_at'].forEach(convertIssuedAt);

  // the expiry value is given as a string; let's make it a number.
  if (b1.expires_in) {
    b1.expires_in = parseInt(b1.expires_in, 10);
    d = new Date(b1.issued_at + b1.expires_in * 1000);
    // provide an expires_at property
    b1.expires_at = d.getTime();
    // and also format the expiry value as a human-readable time
    b1.expires = d.toISOString();
  }

  // the expiry value is given as a string; let's make it a number.
  if (b1.refresh_token_expires_in) {
    b1.refresh_token_expires_in = parseInt(b1.refresh_token_expires_in, 10);
    d = new Date(b1.issued_at + b1.refresh_token_expires_in *1000);
    b1.refresh_token_expires_at = d.getTime();
    b1.refresh_token_expires = d.toISOString();
  }

  // pretty-print JSON
  context.setVariable('response.content', JSON.stringify(b1, null, 2));
}
