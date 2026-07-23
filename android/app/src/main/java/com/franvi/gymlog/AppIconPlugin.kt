package com.franvi.gymlog

import android.content.ComponentName
import android.content.pm.PackageManager
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Cambia el icono del lanzador en caliente.
 *
 * Android no tiene una API para esto: el único camino soportado es declarar un
 * <activity-alias> por variante en el manifest y habilitar el que toque con
 * PackageManager, deshabilitando el resto. El icono por defecto (amarillo) es
 * el de MainActivity, así que ese caso se resuelve apagando todos los alias.
 *
 * Efecto secundario inevitable: el lanzador ve desaparecer un componente y
 * aparecer otro, así que el icono se sale de la pantalla de inicio y reaparece
 * en el cajón de aplicaciones. Por eso la pantalla de Ajustes lo avisa antes.
 */
@CapacitorPlugin(name = "AppIcon")
class AppIconPlugin : Plugin() {
    private val TAG = "AppIcon"

    /**
     * Paquete de las CLASES, que no coincide con el applicationId: la variante
     * fitbody se instala como com.franvi.gymlog.fitbody mientras el código sigue
     * en com.franvi.gymlog. Los `.IconAlias_x` del manifest se resuelven contra
     * el namespace, así que hay que derivarlo de una clase real y no del
     * packageName, o ComponentName apunta a algo que no existe.
     */
    private val classPackage: String
        get() = MainActivity::class.java.name.substringBeforeLast('.')

    /** ComponentName(applicationId, clase completa): admite que difieran. */
    private fun component(className: String) = ComponentName(context.packageName, className)

    private fun aliasName(id: String) = "$classPackage.IconAlias_$id"

    @PluginMethod
    fun setIcon(call: PluginCall) {
        val id = call.getString("id")
        if (id == null) {
            call.reject("Falta el id del icono")
            return
        }
        // Los ids vienen de una lista cerrada en el cliente; aun así se filtra
        // para no construir nombres de componente arbitrarios.
        if (!id.matches(Regex("^[a-z]+$"))) {
            call.reject("Id de icono no válido")
            return
        }

        val pm = context.packageManager
        val all = call.getArray("all")?.toList<String>() ?: emptyList()

        try {
            // DONT_KILL_APP: sin esto Android mata el proceso al reconfigurar el
            // componente y la app se cierra en la cara del usuario.
            for (other in all) {
                if (!other.matches(Regex("^[a-z]+$"))) continue
                val state = if (other == id) {
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                } else {
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED
                }
                pm.setComponentEnabledSetting(
                    component(aliasName(other)),
                    state,
                    PackageManager.DONT_KILL_APP,
                )
            }

            // MainActivity lleva el icono por defecto: solo se deja visible si no
            // hay ninguna variante activa, o el lanzador mostraría dos entradas.
            val main = component(MainActivity::class.java.name)
            pm.setComponentEnabledSetting(
                main,
                if (all.contains(id)) {
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED
                } else {
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                },
                PackageManager.DONT_KILL_APP,
            )

            val ret = JSObject()
            ret.put("ok", true)
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "setIcon($id): ${e.message}")
            call.reject("No se ha podido cambiar el icono: ${e.message}")
        }
    }
}
