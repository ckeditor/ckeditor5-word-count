/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global HTMLElement, setTimeout, document */

import WordCount from '../src/wordcount';

import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';
import { setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { add as addTranslations, _clear as clearTranslations } from '@ckeditor/ckeditor5-utils/src/translation-service';

describe( 'WordCount', () => {
	testUtils.createSinonSandbox();

	let wordCountPlugin, editor, model;

	beforeEach( () => {
		return VirtualTestEditor.create( {
			plugins: [ WordCount, Paragraph ]
		} )
			.then( _editor => {
				editor = _editor;
				model = editor.model;
				wordCountPlugin = editor.plugins.get( 'WordCount' );

				model.schema.extend( '$text', { allowAttributes: 'foo' } );
			} );
	} );

	describe( 'constructor()', () => {
		it( 'has defined "words" property', () => {
			expect( wordCountPlugin.words ).to.equal( 0 );
		} );

		it( 'has defined "characters" property', () => {
			expect( wordCountPlugin.characters ).to.equal( 0 );
		} );

		it( 'has defined "_outputView" property', () => {
			expect( wordCountPlugin._outputView ).to.be.undefined;
		} );

		it( 'has "WordCount" plugin name', () => {
			expect( WordCount.pluginName ).to.equal( 'WordCount' );
		} );
	} );

	describe( 'functionality', () => {
		it( 'counts words', () => {
			expect( wordCountPlugin.words ).to.equal( 0 );

			setModelData( model, '<paragraph>Foo(bar)baz</paragraph>' +
				'<paragraph><$text foo="true">Hello</$text> world.</paragraph>' +
				'<paragraph>1234</paragraph>' +
				'<paragraph>(-@#$%^*())</paragraph>' );

			wordCountPlugin._calcWordsAndCharacters();

			expect( wordCountPlugin.words ).to.equal( 6 );
		} );

		it( 'counts characters', () => {
			setModelData( model, '<paragraph><$text foo="true">Hello</$text> world.</paragraph>' );

			wordCountPlugin._calcWordsAndCharacters();

			expect( wordCountPlugin.characters ).to.equal( 12 );
		} );

		describe( 'update event', () => {
			it( 'fires update event with actual amount of characters and words', () => {
				const fake = sinon.fake();
				wordCountPlugin.on( 'update', fake );

				wordCountPlugin._calcWordsAndCharacters();

				sinon.assert.calledOnce( fake );
				sinon.assert.calledWithExactly( fake, sinon.match.any, { words: 0, characters: 0 } );

				// _calcWordsAndCharacters is throttled, so for this test case is run manually
				setModelData( model, '<paragraph><$text foo="true">Hello</$text> world.</paragraph>' );
				wordCountPlugin._calcWordsAndCharacters();

				sinon.assert.calledTwice( fake );
				sinon.assert.calledWithExactly( fake, sinon.match.any, { words: 2, characters: 12 } );
			} );
		} );
	} );

	describe( 'self-updating element', () => {
		let container;
		beforeEach( () => {
			container = wordCountPlugin.getWordCountContainer();
		} );

		it( 'provides html element', () => {
			expect( container ).to.be.instanceof( HTMLElement );
		} );

		it( 'provided element has proper structure', () => {
			expect( container.tagName ).to.equal( 'DIV' );
			expect( container.classList.contains( 'ck' ) ).to.be.true;
			expect( container.classList.contains( 'ck-word-count' ) ).to.be.true;

			const children = Array.from( container.children );
			expect( children.length ).to.equal( 2 );
			expect( children[ 0 ].tagName ).to.equal( 'DIV' );
			expect( children[ 0 ].innerHTML ).to.equal( 'Words: 0' );
			expect( children[ 1 ].tagName ).to.equal( 'DIV' );
			expect( children[ 1 ].innerHTML ).to.equal( 'Characters: 0' );
		} );

		it( 'updates container content', () => {
			expect( container.innerText ).to.equal( 'Words: 0Characters: 0' );

			setModelData( model, '<paragraph>Foo(bar)baz</paragraph>' +
				'<paragraph><$text foo="true">Hello</$text> world.</paragraph>' );

			wordCountPlugin._calcWordsAndCharacters();

			// There is \n between paragraph which has to be included into calculations
			expect( container.innerText ).to.equal( 'Words: 5Characters: 24' );
		} );

		it( 'subsequent calls provides the same element', () => {
			const newContainer = wordCountPlugin.getWordCountContainer();

			expect( container ).to.equal( newContainer );
		} );

		describe( 'destroy()', () => {
			it( 'html element is removed and cleanup', done => {
				const frag = document.createDocumentFragment();

				frag.appendChild( container );

				expect( frag.querySelector( '*' ) ).to.be.instanceof( HTMLElement );

				editor.destroy()
					.then( () => {
						expect( frag.querySelector( '*' ) ).to.be.null;
					} )
					.then( done )
					.catch( done );
			} );

			it( 'method is called', done => {
				const spy = sinon.spy( wordCountPlugin, 'destroy' );

				editor.destroy()
					.then( () => {
						sinon.assert.calledOnce( spy );
					} )
					.then( done )
					.catch( done );
			} );
		} );
	} );

	describe( '_calcWordsAndCharacters and throttle', () => {
		beforeEach( done => {
			// We need to flush initial throttle value after editor's initialization
			setTimeout( () => {
				done();
			}, 255 );
		} );

		it( 'gets update after model data change', done => {
			const fake = sinon.fake();

			wordCountPlugin.on( 'update', fake );

			// Initial change in model should be immediately reflected in word-count
			setModelData( model, '<paragraph>Hello world.</paragraph>' );

			sinon.assert.calledOnce( fake );
			sinon.assert.calledWith( fake, sinon.match.any, { words: 2, characters: 12 } );

			// Subsequent updates should be throttle and run with last parameters
			setTimeout( () => {
				sinon.assert.calledTwice( fake );
				sinon.assert.calledWith( fake, sinon.match.any, { words: 2, characters: 9 } );

				done();
			}, 255 );

			setModelData( model, '<paragraph>Hello world</paragraph>' );
			setModelData( model, '<paragraph>Hello worl</paragraph>' );
			setModelData( model, '<paragraph>Hello wor</paragraph>' );
		} );
	} );

	describe( 'custom config options', () => {
		it( 'displayWords = false', done => {
			VirtualTestEditor.create( {
				plugins: [ WordCount, Paragraph ],
				wordCount: {
					displayWords: false
				}
			} )
				.then( editor => {
					const wordCountPlugin = editor.plugins.get( 'WordCount' );
					const container = wordCountPlugin.getWordCountContainer();

					expect( container.innerText ).to.equal( 'Characters: 0' );
				} )
				.then( done )
				.catch( done );
		} );

		it( 'displayCharacters = false', done => {
			VirtualTestEditor.create( {
				plugins: [ WordCount, Paragraph ],
				wordCount: {
					displayCharacters: false
				}
			} )
				.then( editor => {
					const wordCountPlugin = editor.plugins.get( 'WordCount' );
					const container = wordCountPlugin.getWordCountContainer();

					expect( container.innerText ).to.equal( 'Words: 0' );
				} )
				.then( done )
				.catch( done );
		} );
	} );

	describe( 'translations', () => {
		before( () => {
			addTranslations( 'pl', {
				Words: 'Słowa',
				Characters: 'Znaki'
			} );
			addTranslations( 'en', {
				Words: 'Words',
				Characters: 'Characters'
			} );
		} );

		after( () => {
			clearTranslations();
		} );

		it( 'applies proper language translations', done => {
			VirtualTestEditor.create( {
				plugins: [ WordCount, Paragraph ],
				language: 'pl'
			} )
				.then( editor => {
					const wordCountPlugin = editor.plugins.get( 'WordCount' );
					const container = wordCountPlugin.getWordCountContainer();

					expect( container.innerText ).to.equal( 'Słowa: 0Znaki: 0' );
				} )
				.then( done )
				.catch( done );
		} );
	} );
} );