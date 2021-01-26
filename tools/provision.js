#! /usr/local/bin/node
/*jslint node:true */
// provisioningTool.js
// ------------------------------------------------------------------
// provision an Apigee Proxy, API Product, Developer, and App
// for the OAuthV2 CC-and-JWT Example. Or de-provision.
//
// Copyright 2017-2020 Google LLC.
//

/* jshint esversion: 9, strict:implied */

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// last saved: <2021-January-26 14:53:52>

const apigeejs   = require('apigee-edge-js'),
      common     = apigeejs.utility,
      apigee     = apigeejs.edge,
      util       = require('util'),
      path       = require('path'),
      sprintf    = require('sprintf-js').sprintf,
      Getopt     = require('node-getopt'),
      version    = '20210126-1426',
      getopt     = new Getopt(common.commonOptions.concat([
        ['R' , 'reset', 'Optional. Reset, delete all the assets previously created by this script'],
        ['e' , 'env=ARG', 'the Edge environment to use for this demonstration. ']
      ])).bindHelp();

// ========================================================

function random(min, max) {
  let delta = max - min;
  return Math.floor(Math.random() * delta) + min;
}

console.log(
  'Apigee CC-and-JWT OAuth Example Provisioning tool, version: ' + version + '\n' +
    'Node.js ' + process.version + '\n');

common.logWrite('start');
let opt = getopt.parse(process.argv.slice(2));
common.verifyCommonRequiredParameters(opt.options, getopt);

if ( !opt.options.env ) {
  console.log('You must specify an environment');
  getopt.showHelp();
  process.exit(1);
}

const constants = {
        discriminators : {
          apiproxy     : 'oauth2-cc-and-jwt',
          product      : 'CC-and-JWT-Example-Product',
          developer    : 'CC-and-JWT-Example-Developer@example.com',
          developerapp : 'CC-and-JWT-Example-App-1'
        },
        note           : 'created '+ (new Date()).toISOString() + ' for CC-and-JWT example',
        appExpiry      : '180d'
      },
      connectOptions = {
        mgmtServer : opt.options.mgmtserver,
        org        : opt.options.org,
        user       : opt.options.username,
        password   : opt.options.password,
        no_token   : opt.options.notoken,
        verbosity  : opt.options.verbose || 0
      },
      proxySource = path.join(__dirname, '..');

apigee.connect(connectOptions)
  .then( org => {
    common.logWrite('connected');
    if (opt.options.reset) {
      let delOptions = {
            app       : { appName: constants.discriminators.developerapp, developerEmail: constants.discriminators.developer },
            developer : { developerEmail: constants.discriminators.developer },
            product   : { productName: constants.discriminators.product },
            proxy     : { environment: opt.options.env, name: constants.discriminators.apiproxy }
          };

      // delete items and ignore 404 errors
      return Promise.resolve({})
        .then( _ => org.developerapps.del(delOptions.app)
               .catch(e => {
                 if ( ! e.result || e.result.code != 'developer.service.DeveloperDoesNotExist' ) {
                   console.log(e);
                 }
               }))
        .then( _ => org.developers.del(delOptions.developer)
               .catch(e => {
                 if ( ! e.result || e.result.code != 'developer.service.DeveloperDoesNotExist' ) {
                   console.log(e);
                 }
               }))
        .then( _ => org.products.del(delOptions.product)
               .catch(e => {
                 if ( ! e.result || e.result.code != 'keymanagement.service.apiproduct_doesnot_exist' ) {
                   console.log(e);
                 }
               }))
        .then( _ => org.proxies.undeploy(delOptions.proxy)
               .catch(e => {
                 if ( ! e.result || (e.result.code != 'distribution.RevisionNotDeployed' &&
                      e.result.code != 'messaging.config.beans.ApplicationDoesNotExist')) {
                   console.log(e);
                 }
               }))
        .then( _ => org.proxies.del(delOptions.proxy)
               .catch(e => {
                 if ( ! e.result || e.result.code != 'messaging.config.beans.ApplicationDoesNotExist' ) {
                   console.log(e);
                 }
               }))

        .then( _ => common.logWrite(sprintf('ok. demo assets have been deleted')) );
    }

    let options = {
          products: {
            create: {
              productName  : constants.discriminators.product,
              description  : 'Test Product for CC-and-JWT Example',
              apiResources : [ "/service/**" ],
              attributes   : { access: 'public', note: constants.note },
              approvalType : 'auto'
            }
          },
          developers: {
            create: {
              developerEmail : constants.discriminators.developer,
              lastName       : 'Developer',
              firstName      : 'CC-and-JWT',
              userName       : 'CC-and-JWT-Example-Developer',
              attributes     : { note: constants.note }
            }
          },
          developerapps: {
            get: {
              developerEmail : constants.discriminators.developer
            },
            create: {
              developerEmail : constants.discriminators.developer,
              appName        : constants.discriminators.developerapp,
              apiProduct     : constants.discriminators.product,
              description    : 'Test Product for CC-and-JWT Example',
              attributes     : { access: 'public', note: constants.note },
              approvalType   : 'auto'
            }
          }
        };

    function conditionallyCreateEntity(entityType) {
      let collectionName = entityType + 's';
      return org[collectionName].get(options[collectionName].get || {})
        .then( result => {
          //console.log('GET Result: ' + JSON.stringify(result));
          if (result.indexOf(constants.discriminators[entityType])>=0) {
            if (collectionName == 'developerapps') {
              return org[collectionName].get({
                developerEmail : constants.discriminators.developer,
                appName        : constants.discriminators.developerapp
              });
            }
            return Promise.resolve(result) ;
          }
          if (opt.options.verbose) {
            console.log('CREATE: ' + JSON.stringify(options[collectionName].create));
          }
          return org[collectionName].create(options[collectionName].create);
        });
    }

    return Promise.resolve({})
      .then( _ => org.proxies.import({source:proxySource}))
      .then( r => org.proxies.deploy({name:r.name, revision:r.revision, environment: opt.options.env}))
      .then( _ => conditionallyCreateEntity('product'))
      .then( _ => conditionallyCreateEntity('developer'))
      .then( _ => conditionallyCreateEntity('developerapp'))
      .then( result => {
        common.logWrite(sprintf('app name: %s', result.name));
        console.log(sprintf('\n\nORG=%s', opt.options.org));
        console.log(sprintf('ENV=%s', opt.options.env));
        console.log(sprintf('client_id=%s', result.credentials[0].consumerKey));
        console.log(sprintf('client_secret=%s', result.credentials[0].consumerSecret));
        console.log();
        console.log('Example Calls:');
        console.log('============================');
        console.log();
        console.log('curl -i -X POST -d "grant_type=client_credentials" "https://$ORG-$ENV.apigee.net/oauth2-cc-and-jwt/dispensary/token1a" -u "${client_id}:${client_secret}"');
        console.log();
        console.log('curl -i -X GET  "https://$ORG-$ENV.apigee.net/oauth2-cc-and-jwt/service/t1" -H "Authorization: Bearer ${TOKEN}"');

      });
  })
  .catch( e => console.log(util.format(e)) );
