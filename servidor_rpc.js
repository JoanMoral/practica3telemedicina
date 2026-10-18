var express = require("express");
var conexion = require("./conexion_mysql.js");
var app = express();
var rpc = require("./rpc.js");

// Ya NO necesitamos datos.js: todos los datos vienen ahora de MySQL a trav�s de "conexion".
// var datos = require("./datos.js");

var servidor = rpc.server(3501, function() { // crear el servidor RPC
    console.log("Servidor RPC escuchando en http://localhost:3501");
});

// Las variables sanitarios, gestores, ubicaciones, categorias, modelos, recursos,
// reservas y resenyas YA NO EXISTEN como arrays en memoria: cada función hace su
// propia consulta a la base de datos cuando la necesita.


// --- CATEGOR�AS Y MODELOS ---

function obtenerCategorias(callback){
    // Antes: return callback(categorias);
    // Ahora consultamos la tabla completa y se la pasamos al callback tal cual.
    var sql = "SELECT * FROM categorias";
    conexion.query(sql, function(err, resultados){
        if(err){
            console.log("Error al obtener categorias", err);
            return callback(null);
        }
        return callback(resultados);
    });
}

function obtenerModelos(callback){
    var sql = "SELECT * FROM modelos";
    conexion.query(sql, function(err, resultados){
        if(err){
            console.log("Error al obtener modelos", err);
            return callback(null);
        }
        return callback(resultados);
    });
}


// --- SANITARIOS ---

function loginSanitario(usuario, password, callback){
    // Antes recorríamos el array sanitarios comparando usuario y password.
    // Ahora se lo pedimos directamente a MySQL con un WHERE.
    if(usuario && password){
        var sql = `SELECT id FROM sanitarios WHERE usuario = '${usuario}' AND password = '${password}'`;
        conexion.query(sql, function(err, resultados){
            if(err){
                console.log("Error al hacer login del sanitario", err);
                return callback(null);
            }
            if(resultados.length == 0){
                // No se ha encontrado ninguna fila que cumpla usuario+password
                return callback(null);
            }
            return callback(resultados[0].id);
        });
    }
    else{
        return callback(null);
    }
}

// Ya no necesitamos "siguienteSanitario": el id lo genera MySQL automáticamente
// (AUTO_INCREMENT) y nos lo devuelve en resultado.insertId.
function crearSanitario(datosSanitario, callback){
    var nombre = datosSanitario.nombre;
    var apellidos = datosSanitario.apellidos;
    var usuario = datosSanitario.usuario;
    var password = datosSanitario.password;

    // Comprobamos que vengan todos los campos, igual que antes.
    if(!nombre || !apellidos || !usuario || !password){
        return callback(null);
    }

    // Ya NO comprobamos manualmente si el usuario existe recorriendo el array:
    // dejamos que salte el índice único de la columna "usuario" en la BD y
    // capturamos el error de duplicado (ER_DUP_ENTRY).
    var sql = `INSERT INTO sanitarios (nombre, apellidos, usuario, password) 
               VALUES ('${nombre}', '${apellidos}', '${usuario}', '${password}')`;

    conexion.query(sql, function(err, resultado){
        if(err){
            if(err.code === "ER_DUP_ENTRY"){
                console.log("Usuario de sanitario repetido");
                return callback(null); // mismo comportamiento que antes: null si usuario repetido
            }
            console.log("Error al crear sanitario", err);
            return callback(null);
        }
        // resultado.insertId es el id que MySQL ha asignado automáticamente
        return callback(resultado.insertId);
    });
}

function actualizarSanitario(idSanitario, datosSanitario, callback){
    var login = datosSanitario.usuario;

    // Igual que en crearSanitario: no comprobamos "a mano" si el usuario ya
    // existe en otro sanitario, dejamos que lo haga el índice único de la BD.
    var sql = `UPDATE sanitarios 
               SET nombre = '${datosSanitario.nombre}', apellidos = '${datosSanitario.apellidos}', usuario = '${login}', password = '${datosSanitario.password}' 
               WHERE id = ${idSanitario}`;

    conexion.query(sql, function(err, resultado){
        if(err){
            if(err.code === "ER_DUP_ENTRY"){
                return callback("Usuario repetido u otro problema");
            }
            console.log("Error al actualizar sanitario", err);
            return callback("Usuario repetido u otro problema");
        }
        if(resultado.affectedRows == 0){
            // No se ha modificado ninguna fila -> ese id no existía
            return callback("Sanitario no encontrado");
        }
        return callback("Sanitario actualizado");
    });
}

function obtenerSanitario(idSanitario, callback){
    // Pedimos solo las columnas que queremos enviar al cliente (sin password),
    // igual que hacías manualmente antes al construir "datosParaEnviar".
    var sql = `SELECT id, nombre, apellidos, usuario FROM sanitarios WHERE id = ${idSanitario}`;
    conexion.query(sql, function(err, resultados){
        if(err){
            console.log("Error al obtener sanitario", err);
            return callback(null);
        }
        if(resultados.length == 0){
            return callback(null);
        }
        return callback(resultados[0]);
    });
}


// --- RESERVAS Y RESE�AS ---

function obtenerReservas(idSanitario, callback){
    var sql = `SELECT * FROM reservas WHERE sanitario = ${idSanitario}`;
    conexion.query(sql, function(err, resultados){
        if(err){
            console.log("Error al obtener reservas", err);
            return callback(null);
        }
        return callback(resultados);
    });
}

function obtenerResenyas(idRecurso, callback){
    var sql = `SELECT * FROM resenyas WHERE recurso = ${idRecurso}`;
    conexion.query(sql, function(err, resultados){
        if(err){
            console.log("Error al obtener resenyas", err);
            return callback(null);
        }
        return callback(resultados);
    });
}

// Ya no usamos "siguienteIdResenyas": el id lo pone MySQL con AUTO_INCREMENT.
function crearResenya(idRecurso, idSanitario, valoracion, descripcion, callback){
    // Esta validación de rango sí la mantenemos en JavaScript, porque no depende
    // de la base de datos, es una simple comprobación de negocio.
    if(valoracion < 1 || valoracion > 5){
        return callback(null);
    }

    // La fecha la genera la propia BD con NOW(), en vez de "new Date()" en JS,
    // para que quede guardada con la hora del servidor de la base de datos.
    var sql = `INSERT INTO resenyas (recurso, sanitario, fecha, valor, descripcion) 
               VALUES (?, ?, NOW(), ?, ?)`;

    conexion.query(sql,[idRecurso, idSanitario, valoracion,descripcion], function(err, resultado){
        if(err){
            console.log("Error al crear resenya", err);
            return callback(null);
        }
        return callback(resultado.insertId);
    });
}


// --- RECURSOS ---

function obtenerRecursos(idModelo, callback){
    // El cliente nunca verá recursos defectuosos o en mantenimiento (estado != 0),
    // igual que en el filtro que tenías con el array.
    var sql = `SELECT * FROM recursos WHERE modelo = ${idModelo} AND estado = 0`;
    conexion.query(sql, function(err, resultados){
        if(err){
            console.log("Error al obtener recursos", err);
            return callback(null);
        }
        if(resultados.length == 0){
            return callback(null);
        }
        return callback(resultados);
    });
}

function obtenerRecurso(idRecurso, callback){
    var sql = `SELECT * FROM recursos WHERE id = ${idRecurso}`;
    conexion.query(sql, function(err, resultados){
        if(err){
            console.log("Error al obtener el recurso", err);
            return callback(null);
        }
        if(resultados.length == 0){
            return callback(null);
        }
        return callback(resultados[0]);
    });
}

function obtenerUbicaciones(callback){
    var sql = "SELECT * FROM ubicaciones";
    conexion.query(sql, function(err, resultados){
        if(err){
            console.log("Error al obtener ubicaciones", err);
            return callback(null);
        }
        return callback(resultados);
    });
}


// --- GESTI�N DE RESERVAS (con lógica encadenada) ---

function cancelarReserva(idReserva, callback){
    // Antes buscábamos el índice y hacíamos splice; ahora un DELETE directo.
    var sql = `DELETE FROM reservas WHERE id = ${idReserva} AND fecha_inicio IS NULL`;
    conexion.query(sql, function(err, resultado){
        if(err){
            console.log("Error al cancelar reserva", err);
            return callback(null);
        }
        if(resultado.affectedRows == 0){
            // No existía esa reserva
            return callback(null);
        }
        return callback("Reserva eliminada");
    });
}

function iniciarReserva(idReserva, callback){
    // Antes: buscar la reserva en el array y comprobar que fecha_inicio fuera null.
    // Ahora hacemos un UPDATE que SOLO afecta si fecha_inicio es NULL: la propia
    // condición WHERE hace de "comprobación". Si no afecta a ninguna fila, es que
    // no existía o ya estaba iniciada.
    var sql = `UPDATE reservas SET fecha_inicio = NOW() WHERE id = ${idReserva} AND fecha_inicio IS NULL`;
    conexion.query(sql, function(err, resultado){
        if(err){
            console.log("Error al iniciar reserva", err);
            return callback("Reserva no encontrada.");
        }
        if(resultado.affectedRows == 0){
            return callback("Reserva no encontrada.");
        }
        return callback("Reserva iniciada.");
    });
}

function finalizarReserva(idReserva, callback){
    // Mismo patrón que iniciarReserva, pero para fecha_fin.
    // Antes se distinguía entre "no encontrada" y "ya finalizada" recorriendo el
    // array; con SQL puro no podemos distinguir directamente ambos casos con un
    // solo UPDATE, así que primero comprobamos si existe la reserva.
    var sqlComprobar = `SELECT fecha_fin FROM reservas WHERE id = ${idReserva}`;
    conexion.query(sqlComprobar, function(err, resultados){
        if(err){
            console.log("Error al comprobar reserva", err);
            return callback("No se ha encontrado la reserva.");
        }
        if(resultados.length == 0){
            return callback("No se ha encontrado la reserva.");
        }
        if(resultados[0].fecha_fin != null){
            return callback("La reserva ya está finalizada");
        }

        var sqlUpdate = `UPDATE reservas SET fecha_fin = NOW() WHERE id = ${idReserva}`;
        conexion.query(sqlUpdate, function(err, resultado){
            if(err){
                console.log("Error al finalizar reserva", err);
                return callback("No se ha encontrado la reserva.");
            }
            return callback("Se ha finalizado la reserva con id: " + idReserva);
        });
    });
}

function reservarRecurso(idRecurso, idSanitario, horas, callback){
    // Esta función antes hacía 3 comprobaciones sobre arrays distintos:
    // 1) que el recurso exista
    // 2) que las horas no superen las horas_maximas de su modelo
    // 3) que el recurso no esté "cascado" (estado != 0)
    // Con MySQL, cada comprobación que necesita datos de la BD implica una
    // consulta, y como son asíncronas, las anidamos unas dentro de otras.

    var sqlRecurso = `SELECT * FROM recursos WHERE id = ${idRecurso}`;
    conexion.query(sqlRecurso, function(err, recursos){
        if(err){
            console.log("Error al buscar recurso", err);
            return callback("Recurso no encontrado.");
        }
        if(recursos.length == 0){
            return callback("Recurso no encontrado."); // 1) no existe
        }

        var recurso = recursos[0];

        if(recurso.estado != 0){
            return callback(null); // 3) está "cascado" (no operativo)
        }

        var sqlModelo = `SELECT horas_maximas FROM modelos WHERE id = ${recurso.modelo}`;
        conexion.query(sqlModelo, function(err, modelos){
            if(err){
                console.log("Error al buscar modelo", err);
                return callback("Recurso no encontrado.");
            }
            if(modelos.length == 0){
                return callback("Recurso no encontrado.");
            }

            var modelo = modelos[0];

            if(modelo.horas_maximas < horas){
                return callback("Has sobrepasado las horás máximas del modelo."); // 2)
            }

            // Todo correcto -> insertamos la reserva. El id lo genera MySQL.
            var sqlInsert = `INSERT INTO reservas (recurso, sanitario, horas_estimadas, fecha_peticion, fecha_inicio, fecha_fin) 
                              VALUES (${idRecurso}, ${idSanitario}, ${horas}, NOW(), NULL, NULL)`;

            conexion.query(sqlInsert, function(err, resultado){
                if(err){
                    console.log("Error al crear la reserva", err);
                    return callback(null);
                }
                return callback(resultado.insertId);
            });
        });
    });
}

function tiempoPendiente(idRecurso, idReserva, callback){
    // Antes filtrábamos el array "reservas" a mano y lo ordenábamos con .sort().
    // Ahora le pedimos directamente a MySQL que nos devuelva ya ordenadas por
    // fecha_peticion con ORDER BY, y el cálculo de horas (que es lógica de
    // negocio, no de base de datos) lo seguimos haciendo en JavaScript igual
    // que antes.
    var sql = `SELECT * FROM reservas WHERE recurso = ${idRecurso} ORDER BY fecha_peticion ASC`;

    conexion.query(sql, function(err, reservas_recurso){
        if(err){
            console.log("Error al calcular tiempo pendiente", err);
            return callback(0);
        }

        if(reservas_recurso.length === 0){
            return callback(0);
        }

        var ahora = new Date();
        var tiempoAcumulado = 0;

        for(var i = 0; i < reservas_recurso.length; i++){
            var reserva = reservas_recurso[i];

            if(reserva.id == idReserva){
                return callback(Math.round(tiempoAcumulado * 100) / 100);
            }

            if(reserva.fecha_inicio != null && reserva.fecha_fin == null){
                var horasTranscurridas = (ahora - new Date(reserva.fecha_inicio)) / (1000 * 60 * 60);
                var tiempoRestante = reserva.horas_estimadas - horasTranscurridas;
                if(tiempoRestante > 0){
                    tiempoAcumulado += tiempoRestante;
                }
            } else if(reserva.fecha_inicio == null){
                tiempoAcumulado += reserva.horas_estimadas;
            }
        }

        return callback(Math.round(tiempoAcumulado * 100) / 100);
    });
}




// --- CONFIGURACI�N DEL SERVIDOR RPC (igual que antes, no cambia nada aquí) ---

var app = servidor.createApp("gestion_sanitarios");

app.registerAsync(cancelarReserva);
app.registerAsync(obtenerCategorias);
app.registerAsync(obtenerModelos);
app.registerAsync(loginSanitario);
app.registerAsync(crearSanitario);
app.registerAsync(obtenerReservas);
app.registerAsync(obtenerResenyas);
app.registerAsync(crearResenya);
app.registerAsync(actualizarSanitario);
app.registerAsync(obtenerSanitario);
app.registerAsync(obtenerRecursos);
app.registerAsync(finalizarReserva);
app.registerAsync(iniciarReserva);
app.registerAsync(reservarRecurso);
app.registerAsync(tiempoPendiente);
app.registerAsync(obtenerRecurso);
app.registerAsync(obtenerUbicaciones);



