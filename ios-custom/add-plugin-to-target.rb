#!/usr/bin/env ruby
# Añade los ficheros nativos custom (BiometricPlugin.swift/.m) al target "App"
# del proyecto Xcode generado. El template de Capacitor usa referencias de fichero
# EXPLÍCITAS (no synchronized groups), así que copiarlos al disco no basta: hay que
# registrarlos en project.pbxproj o no se compilan.
#
# Requiere la gema `xcodeproj` (viene con CocoaPods, preinstalado en macos-latest).
# Uso: ruby ios-custom/add-plugin-to-target.rb [ios/App/App.xcodeproj]
require 'xcodeproj'

project_path = ARGV[0] || 'ios/App/App.xcodeproj'
abort "No existe el proyecto #{project_path}" unless File.exist?(project_path)

project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'App' }
abort 'Target "App" no encontrado' unless target

# Grupo "App" (mapea a ios/App/App, donde el workflow copió los ficheros).
group = project.main_group['App'] || project.main_group.find_subpath('App', true)

files = %w[BiometricPlugin.swift BiometricPlugin.m HealthBridgePlugin.swift HealthBridgePlugin.m]
files.each do |fname|
  already = target.source_build_phase.files_references.any? do |ref|
    ref.respond_to?(:display_name) && ref.display_name == fname
  end
  if already
    puts "Ya estaba: #{fname}"
    next
  end
  file_ref = group.new_reference(fname)
  target.add_file_references([file_ref])
  puts "Añadido al target: #{fname}"
end

# Entitlement HealthKit: registrar el fichero y apuntar CODE_SIGN_ENTITLEMENTS.
# (En el smoke build sin firma se ignora; necesario para device/distribución.)
entitlements = 'App.entitlements'
unless group.files.any? { |f| f.respond_to?(:display_name) && f.display_name == entitlements }
  group.new_reference(entitlements)
  puts "Añadido al grupo: #{entitlements}"
end
target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements'
end
puts 'CODE_SIGN_ENTITLEMENTS -> App/App.entitlements'

project.save
puts "Guardado #{project_path}"
