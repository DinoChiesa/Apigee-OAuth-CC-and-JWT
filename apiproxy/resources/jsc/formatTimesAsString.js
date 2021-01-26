// formatTimesAsString.js
// ------------------------------------------------------------------
//
/* global response, context, properties */

var POLICYNAME = properties.POLICYNAME,
    varPrefix = 'oauthv2accesstoken.' + POLICYNAME,
    expiresIn = Number(context.getVariable(varPrefix + '.expires_in')),
    issuedAt = new Date(Number(context.getVariable(varPrefix + '.issued_at'))),
    expiry = new Date(Date.now().valueOf() + (expiresIn * 1000));

// format the expiry value as a human-readable time
context.setVariable('expiry_string', expiry.toISOString());

// format the issue time as seconds-since-epoch
context.setVariable('issued_at', (issuedAt.valueOf() / 1000).toFixed(0));

// format the issue time as a human-readable string
context.setVariable('issued_string', issuedAt.toISOString());
