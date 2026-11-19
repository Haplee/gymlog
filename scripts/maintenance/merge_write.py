import os  
write_methods_path = r'C:\Users\franc\proyectos\apps\gymlog\write_methods.kt'  
main_path = r'C:\Users\franc\proyectos\apps\gymlog\android\app\src\main\java\com\franvi\gymlog\HealthBridgePlugin.kt'  
with open(write_methods_path, 'r', encoding='utf-8') as f:  
    write_methods = f.read()  
with open(main_path, 'r', encoding='utf-8') as f:  
    main_content = f.read()  
new_content = main_content.replace('    private fun emptyResult(): JSObject {', write_methods)  
with open(main_path, 'w', encoding='utf-8') as f:  
    f.write(new_content)  
print('Done') 
