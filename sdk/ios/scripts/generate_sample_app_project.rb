#!/usr/bin/env ruby
# frozen_string_literal: true

require 'fileutils'
require 'pathname'
require 'xcodeproj'

root = Pathname.new(__dir__).join('..').expand_path
sample_root = root.join('sample-app')
project_path = sample_root.join('OpenStorySample.xcodeproj')
app_root = sample_root.join('OpenStorySample')

FileUtils.rm_rf(project_path)

project = Xcodeproj::Project.new(project_path.to_s)
project.root_object.attributes['LastUpgradeCheck'] = '1620'
project.root_object.attributes['LastSwiftUpdateCheck'] = '1620'

app_group = project.main_group.new_group('OpenStorySample', 'OpenStorySample')
project.frameworks_group

target = project.new_target(:application, 'OpenStorySample', :ios, '15.0', nil, :swift)
target.product_name = 'OpenStorySample'

package_reference = project.new(Xcodeproj::Project::Object::XCLocalSwiftPackageReference)
package_reference.relative_path = '..'
project.root_object.package_references << package_reference

package_product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
package_product.package = package_reference
package_product.product_name = 'OpenStorySDK'
target.package_product_dependencies << package_product

package_build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
package_build_file.product_ref = package_product
target.frameworks_build_phase.files << package_build_file

source_files = %w[
  AppDelegate.swift
  SceneDelegate.swift
  SampleConfig.swift
  SampleRootTabBarController.swift
  SampleHomeViewController.swift
  SamplePlaceholderViewController.swift
]
resource_files = %w[
  Assets.xcassets
  Base.lproj/LaunchScreen.storyboard
]

source_refs = source_files.map { |path| app_group.new_file(path) }
resource_refs = resource_files.map { |path| app_group.new_file(path) }
target.add_file_references(source_refs)
target.add_resources(resource_refs)

project.build_configurations.each do |configuration|
  configuration.build_settings['SWIFT_VERSION'] = '5.0'
  configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  configuration.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
end

target.build_configurations.each do |configuration|
  configuration.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.openstory.sample.ios'
  configuration.build_settings['INFOPLIST_FILE'] = 'OpenStorySample/Info.plist'
  configuration.build_settings['GENERATE_INFOPLIST_FILE'] = 'NO'
  configuration.build_settings['SWIFT_VERSION'] = '5.0'
  configuration.build_settings['SWIFT_EMIT_LOC_STRINGS'] = 'YES'
  configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
  configuration.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  configuration.build_settings['MARKETING_VERSION'] = '1.0'
  configuration.build_settings['CURRENT_PROJECT_VERSION'] = '1'
  configuration.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  configuration.build_settings['ASSETCATALOG_COMPILER_APPICON_NAME'] = ''
  configuration.build_settings['ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME'] = 'AccentColor'
  configuration.build_settings['ENABLE_PREVIEWS'] = 'YES'
  configuration.build_settings['LD_RUNPATH_SEARCH_PATHS'] = ['$(inherited)', '@executable_path/Frameworks']
  configuration.build_settings['SUPPORTED_PLATFORMS'] = 'iphonesimulator iphoneos'
  configuration.build_settings['SUPPORTS_MACCATALYST'] = 'NO'
  configuration.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
end

scheme = Xcodeproj::XCScheme.new
scheme.configure_with_targets(target, nil, launch_target: true)
scheme.save_as(project_path, 'OpenStorySample', true)

project.sort
project.save

puts "Generated #{project_path.relative_path_from(root)}"
