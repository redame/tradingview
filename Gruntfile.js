"use strict";

module.exports = function (grunt) {

	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-rename');
	grunt.loadNpmTasks('grunt-text-replace');
	grunt.loadNpmTasks('grunt-gh-pages');
	grunt.loadNpmTasks('grunt-bump');
	grunt.loadNpmTasks("grunt-remove-logging");
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.initConfig({
	    pkg: grunt.file.readJSON('package.json'),
	    connect: {
        	server: {
            		options: {
                		port: 9002,
                		base: 'dist',
                		hostname: '0.0.0.0',
                		keepalive: true
            		}
            	}
	    },
			clean: {
				dist : ['dist'],
				todo : ['dist/**/TODO'],
				dist_udf : [
					'dist/v<%=pkg.version%>/charting_library/datafeed/udf/*.js',
					'!dist/v<%=pkg.version%>/charting_library/datafeed/udf/datafeed.js'
				]
			},
			copy: {
				main: {
					files: [
						{expand: true, cwd: 'src/', src: ['**'], dest: 'dist/v<%=pkg.version%>'}
					]
				}
			},
			rename: {
				moveThis: {
					src: 'dist/v<%=pkg.version%>/index.html',
					dest: 'dist/index.html'
				}
			},
			replace: {
				version: {
					src: ['dist/index.html'],
					overwrite: true,
					replacements: [{
						from: 'v1.0.0',
						to: 'v<%=pkg.version%>'
					}]
				}
			},
      concat: {
          js: {
              options: {
                  separator: ''
              },
              	src: ['dist/v<%=pkg.version%>/charting_library/datafeed/udf/datafeed.js', 'dist/v<%=pkg.version%>/charting_library/datafeed/udf/*.js'],
              dest: 'dist/v<%=pkg.version%>/charting_library/datafeed/udf/datafeed.js'
          }
      },
      uglify: {
          options: {
              compress: true,
              mangle: true
          },
          target: {
						files: {
							'dist/v<%=pkg.version%>/charting_library/datafeed/udf/datafeed.js' : 'dist/v<%=pkg.version%>/charting_library/datafeed/udf/datafeed.js',
							'dist/v<%=pkg.version%>/common.js' : 'dist/v<%=pkg.version%>/common.js',
							'dist/v<%=pkg.version%>/main.js' : 'dist/v<%=pkg.version%>/main.js'
						}
          }
      },
	    'gh-pages': {
	        'gh-pages-beta': {
	            options: {
	                base: 'dist',
	                add: true,
	                repo: 'https://' + process.env.GIT_KEY + '@github.com/binary-com/tradingview.git',
	                message: 'Commiting v<%=pkg.version%> using TravisCI and GruntJS build process for beta'
	            },
	            src: ['**/*']
	        },
	        'gh-pages-prod': {
	            options: {
	                base: 'dist',
	                add: true,
	                repo: 'https://' + process.env.GIT_KEY + '@github.com/binary-com/tradingview.git',
	                message: 'Commiting v<%=pkg.version%> using TravisCI and GruntJS build process for prod'
	            },
	            src: ['**/*']
	        }
	    },
	    bump: {
	        options: {
	            files: ['package.json'],
	            updateConfigs: [],
	            commit: false,
	            /*commitMessage: 'Release v%VERSION%',
	            commitFiles: ['package.json'],*/
	            createTag: false,
	            /*tagName: 'v%VERSION%',
	            tagMessage: 'Version %VERSION%',*/
	            push: false,
	            /*pushTo: 'upstream',
	            gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
	            globalReplace: false,
	            prereleaseName: false,*/
	            regExp: false
	        }
	    },
			removelogging: {
				dist: {
					src : "dist/**/datafeed.js"
				}
			},
			watch: {
			  scripts: {
			    files: ['src/**'],
			    tasks: ['core-tasks'],
			    options: {
			      spawn: true,
			    },
			  },
			}
    	});

			grunt.registerTask('core-tasks', ['clean:dist', 'copy:main', 'clean:todo', 'rename', 'replace', 'concat', 'clean:dist_udf']);
			grunt.registerTask('default', ['core-tasks', 'removelogging', 'uglify']);

};
