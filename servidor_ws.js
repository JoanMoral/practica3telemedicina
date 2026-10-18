var http = require("http");
var httpServer = http.createServer();
var conexion = require("./conexion_mysql.js");

// Función modificada para devolver una Promesa (manejo asíncrono de MySQL)
function cargarReservas() {
    return new Promise((resolve, reject) => {
        var sql = "SELECT * FROM reservas";
        conexion.query(sql, function (err, reservasAux) {
            if (err) {
                console.log("Error al cargar Reservas en WS:", err);
                reject(err);
            } else {
                resolve(reservasAux);
            }
        });
    });
}

// Crear servidor WS
// Necesita tener instalado el módulo websocket: npm install websocket
var WebSocketServer = require("websocket").server;
var wsServer = new WebSocketServer({
    httpServer: httpServer
});

// Iniciar el servidor HTTP en un puerto
var puerto = 4444;
httpServer.listen(puerto, function () {
    console.log("Servidor de WebSocket iniciado en puerto:", puerto);
});

var clientes = []; // array de los clientes que se conectan

function iniciarWSAvisos(httpServer) {

    wsServer.on("request", function(request) { // esperas conexión
        var connection = request.accept("avisos", request.origin);
        var cliente = { connection: connection, tipo: null, id: null, nombre: null };
        clientes.push(cliente); // guardamos la conexión

        // Agregamos 'async' para poder usar 'await' con la consulta a la BD
        connection.on("message", async function(message) {
            if (message.type !== "utf8") return;
            var msg = JSON.parse(message.utf8Data);

            switch (msg.operacion) {

                case "identificar":
                    // El cliente se identifica tras hacer login
                    cliente.tipo = msg.tipo;       // "gestor" o "sanitario"
                    cliente.id = msg.id;
                    cliente.nombre = msg.nombre;
                    break;

                case "avisoReserva":
                    try {
                        // Esperamos a que la base de datos devuelva los registros
                        var reservas = await cargarReservas();
                        
                        let afectados = [];
                        // 1. Buscamos en las reservas globales quién tiene este recurso (sin haber terminado)
                        for (var i = 0 ; i < reservas.length; i++) {
                            if (reservas[i].recurso == msg.idRecurso && reservas[i].fecha_fin == null) {
                                afectados.push(reservas[i].sanitario); // AÑADIMOS LOS SANITARIOS QUE TENGAN ESE RECURSO ACTIVO
                            }
                        }

                        // Creamos la respuesta
                        var aviso = {
                            operacion: "aviso",
                            color: "rojo",
                            fecha: new Date().toLocaleString(),
                            origen: msg.quien,
                            texto: "SE HA " + msg.accion + " LA RESERVA DEL " +
                                msg.nombreCategoria.toUpperCase() + " MODELO " +
                                msg.nombreModelo.toUpperCase() + " CON CÓDIGO " + msg.codigoRecurso
                        };

                        // 2. Enviamos el aviso SOLO a los afectados conectados
                        for (var i = 0; i < clientes.length; i++) {
                            if (clientes[i].tipo === "sanitario") {
                                for (var k = 0; k < afectados.length; k++) {
                                    if (String(afectados[k]) === String(clientes[i].id)) {
                                        clientes[i].connection.sendUTF(JSON.stringify(aviso));
                                        break; 
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Error al procesar el aviso de reserva:", err);
                    }
                    break;

                case "avisoNuevoRecurso":
                    // Un gestor creó un nuevo recurso -> avisar a TODOS los sanitarios
                    var aviso = {
                        operacion: "aviso",
                        color: "azul",
                        fecha: new Date().toLocaleString(),
                        origen: msg.quien,
                        texto: "SE HA CREADO UN NUEVO RECURSO " +
                        msg.nombreCategoria.toUpperCase() + " MODELO " +
                        msg.nombreModelo.toUpperCase() + " CON CÓDIGO " + msg.codigoRecurso
                    };
                    for (var i = 0; i < clientes.length; i++) {
                        if (clientes[i].tipo === "sanitario") {
                            clientes[i].connection.sendUTF(JSON.stringify(aviso));
                        }
                    }
                    break;

                case "avisoResenya":
                    // Un sanitario escribió una reseña -> avisar a TODOS los gestores
                    var aviso = {
                        operacion: "aviso",
                        color: "verde",
                        fecha: new Date().toLocaleString(),
                        origen: msg.quien,
                        texto: "SE HA CREADO UNA RESEÑA PARA EL " +
                        msg.nombreCategoria.toUpperCase() + " MODELO " +
                        msg.nombreModelo.toUpperCase() + " CON CÓDIGO " +
                        msg.codigoRecurso + " Y PUNTUACIÓN " + msg.puntuacion
                    };
                    for (var i = 0; i < clientes.length; i++) {
                        if (clientes[i].tipo === "gestor") {
                            clientes[i].connection.sendUTF(JSON.stringify(aviso));
                        }
                    }
                    break;
            }
        });

        connection.on("close", function() {
            for (var i = 0; i < clientes.length; i++) {
                if (clientes[i].connection === connection) {
                    clientes.splice(i, 1);
                    break;
                }
            }
        });
    });

    console.log("Servidor WebSocket de avisos iniciado");
}

module.exports = iniciarWSAvisos;