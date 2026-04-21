Pod::Spec.new do |s|
  s.name             = 'open_story_flutter'
  s.version          = '0.1.0'
  s.summary          = 'Flutter wrapper for the open-story native SDKs.'
  s.description      = <<-DESC
Thin Flutter wrapper around the open-story native Android and iOS SDKs.
                       DESC
  s.homepage         = 'https://example.com/open-story'
  s.license          = { :type => 'Proprietary', :text => 'Internal use only.' }
  s.author           = { 'open-story' => 'engineering@example.com' }
  s.source           = { :path => '.' }
  s.source_files     = 'Classes/**/*', 'OpenStorySDK/**/*.swift'
  s.platform         = :ios, '15.0'
  s.swift_version    = '5.9'
  s.static_framework = true

  s.dependency 'Flutter'
  s.frameworks = 'UIKit', 'AVFoundation', 'CryptoKit'
  s.libraries = 'sqlite3'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386'
  }
end
