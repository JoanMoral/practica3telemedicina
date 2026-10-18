var express = require("express");
var jwt = require("jwt-simple");
var clave = "miSecretoMasOscuro";
var conexion = require("./conexion_mysql.js");
var app = express();
app.listen(3000);
app.use("/gestor", express.static("cliente_rest"));
app.use("/sanitario", express.static("cliente_rpc"));
app.use(express.json());

// ---------- Middleware JWT: protege todo /api salvo login y registro ----------
app.use("/api", function (req, res, next) {

    // Acceso libre para hacer login o registrarse (POST /api/gestores)
    if (req.path === "/gestores/login" || (req.path === "/gestores" && req.method === "POST")) {
        return next();
    }

    var token = req.query.token;
    if (!token) {
        res.status(401).json("No se ha encontrado token");
        return;
    }

    var contenidoToken;
    try {
        contenidoToken = jwt.decode(token, clave);
    } catch (error) {
        res.status(401).json("El token es incorrecto");
        return;
    }

    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        res.status(401).json("El formato del token no es adecuado");
        return;
    }

    if (contenidoToken.expira < Date.now()) {
        res.status(401).json("El token ha expirado");
        return;
    }

    next();
});

// ---------- Catálogos ----------
app.get("/api/ubicaciones", function(req, res){
    var sql = "SELECT * FROM ubicaciones";
    conexion.query(sql, function(err, ubicaciones){
        if(err){
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            res.status(200).json(ubicaciones);
        }
    })
})

app.get("/api/categorias", function(req, res){
    var sql = "SELECT * FROM categorias";
    conexion.query(sql, function(err, categorias){
        if(err){
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            res.status(200).json(categorias);
        }
    })
})

app.get("/api/modelos", function(req, res){
    var sql = "SELECT * FROM modelos";
    conexion.query(sql, function(err, modelos){
        if(err){
            console.log("Error al realizar la select", err);
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            res.status(200).json(modelos);
        }
    })
})

// ---------- Gestores y sanitarios ----------
app.get("/api/gestores/:id", function(req, res){
    var id = req.params.id;
    var sql = "SELECT id,nombre,apellidos,usuario FROM gestores WHERE gestores.id = ?";
    conexion.query(sql, [id], function(err, gestor){
        if(err){
            console.log("Error al realizar el select", err);
            res.status(500).json("Error al realizar la consulta");
        }
        else if(gestor.length == 0){
            res.status(404).json("No se ha encontrado");
        }
        else{
            res.status(200).json(gestor[0]);
        }
    })
})

app.get("/api/sanitarios/:id", function(req, res){
    var id = req.params.id;
    var sql = "SELECT id,nombre,apellidos,usuario FROM sanitarios WHERE sanitarios.id = ?";
    conexion.query(sql, [id], function(err, sanitario){
        if(err){
            console.log("Error al realizar el select", err);
            res.status(500).json("Error al realizar la consulta");
        }
        else if(sanitario.length == 0){
            res.status(404).json("No se ha encontrado");
        }
        else{
            res.status(200).json(sanitario[0]);
        }
    })
})

// ---------- Recursos ----------
app.get("/api/recursos/:id", function(req, res){
    var id = req.params.id;
    var sql = "SELECT * FROM recursos WHERE recursos.id = ?";
    conexion.query(sql, [id], function(err, recurso){
        if(err){
            console.log("Error al realizar el select", err);
            res.status(500).json("Error al realizar la consulta");
        }
        else if(recurso.length == 0){
            res.status(404).json("No se ha encontrado");
        }
        else{
            res.status(200).json(recurso[0]);
        }
    })
})

// Reservas de un recurso. Ahora incluye los apellidos del sanitario
// (necesarios para el envío al Ministerio) y devuelve [] si no hay reservas.
app.get("/api/recursos/:id/reservas", function(req, res){
    var id = req.params.id;
    var sql = "SELECT r.id, s.nombre AS sanitario, s.nombre AS sanitario_nombre, s.apellidos AS sanitario_apellidos, " +
              "r.horas_estimadas, r.fecha_peticion, r.fecha_inicio, r.fecha_fin " +
              "FROM reservas r INNER JOIN sanitarios s ON r.sanitario = s.id WHERE r.recurso = ?";
    conexion.query(sql, [id], function(err, reservas){
        if(err){
            console.log("Error al realizar el select", err);
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            res.status(200).json(reservas);
        }
    })
})

app.get("/api/recursos/:id/resenyas", function(req, res){
    var id = req.params.id;
    var sql = `
    SELECT 
        r.fecha,
        s.nombre AS sanitario,
        r.valor,
        r.descripcion
    FROM resenyas r
    INNER JOIN sanitarios s ON r.sanitario = s.id
    WHERE r.recurso = ?`;
    conexion.query(sql, [id], function(err, resenyas){
        if(err){
            console.log("Error al realizar el select", err);
            res.status(500).json("Error al realizar la consulta");
        }
        else{
            res.status(200).json(resenyas);
        }
    })
})

app.get("/api/recursos", function(req, res){

    var categoria = req.query.categoria;
    var modelo = req.query.modelo;
    var ubicacion = req.query.ubicacion;
    var estado = req.query.estado;

    var sql = `
        SELECT r.*
        FROM recursos r
        INNER JOIN modelos m ON r.modelo = m.id
        WHERE 1=1
    `;
    var params = [];

    // Un filtro solo se aplica si tiene valor y no es "Todos"
    function aplicar(valor){
        return valor !== undefined && valor !== "" && valor != "Todos";
    }

    if(aplicar(ubicacion)){
        sql += " AND r.ubicacion = ?";
        params.push(ubicacion);
    }
    if(aplicar(estado)){
        sql += " AND r.estado = ?";
        params.push(estado);
    }
    if(aplicar(modelo)){
        sql += " AND r.modelo = ?";
        params.push(modelo);
    }
    if(aplicar(categoria)){
        sql += " AND m.categoria = ?";
        params.push(categoria);
    }

    conexion.query(sql, params, function(err, resultados){
        if(err){
            console.log(err);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.status(200).json(resultados);
    });
});

app.post("/api/recursos", function(req, res){
    var estado = req.body.estado;

    if(estado != 0 && estado != 1 && estado != 2){
        return res.status(400).json("Estado invalido");
    }

    var sql = "INSERT INTO recursos (modelo, ubicacion, numero_serie, estado) VALUES (?, ?, ?, ?)";
    var params = [req.body.modelo, req.body.ubicacion, req.body.numero_serie, estado];

    conexion.query(sql, params, function(err, resultado){
        if(err){
            if(err.code === "ER_DUP_ENTRY"){
                return res.status(400).json({ error: "Numero de serie ya existe." });
            }
            console.log("Error al insertar el recurso", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.status(201).json("Recurso creado");
    });
});

app.put("/api/recursos/:id", function(req, res){
    var id_recurso = req.params.id;

    var sql = "UPDATE recursos SET numero_serie = ?, modelo = ?, ubicacion = ?, estado = ? WHERE id = ?";
    var params = [req.body.numero_serie, req.body.modelo, req.body.ubicacion, req.body.estado, id_recurso];

    conexion.query(sql, params, function(err, resultado){
        if(err){
            if(err.code === "ER_DUP_ENTRY"){
                return res.status(400).json({ error: "Numero de serie ya existe." });
            }
            console.log("Error al actualizar el recurso", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(resultado.affectedRows == 0){
            return res.status(404).json("No se ha encontrado el recurso.");
        }
        res.status(201).json("Se han actualizado los datos.");
    });
});

app.delete("/api/recursos/:id", function(req, res){
    var id_recurso = req.params.id;

    var sql = "DELETE FROM recursos WHERE id = ?";
    conexion.query(sql, [id_recurso], function(err, resultado){
        if(err){
            console.log("Error al eliminar el recurso", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        if(resultado.affectedRows == 0){
            return res.status(404).json("No se ha encontrado el recurso con id: " + id_recurso);
        }
        res.status(200).json("El recurso con identificador: " + id_recurso + " ha sido eliminado");
    });
});

// ---------- Gestores: registro, login y edición ----------
app.post("/api/gestores", function(req, res){
    var sql = "INSERT INTO gestores (nombre, apellidos, usuario, password) VALUES (?, ?, ?, ?)";
    var params = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password];

    conexion.query(sql, params, function(err, resultado){
        if(err){
            if(err.code === "ER_DUP_ENTRY"){
                return res.status(404).json("Usuario no valido");
            }
            console.log("Error al insertar el gestor", err);
            return res.status(500).json("Error al realizar la consulta");
        }
        res.status(201).json("Gestor creado");
    });
});

// Devuelve el token JWT y el id del gestor: { token, usuario }
app.post("/api/gestores/login", function(req, res){
    var usuario = req.body.usuario;
    var password = req.body.password;

    var sql = "SELECT id, password FROM gestores WHERE usuario = ?";
    conexion.query(sql, [usuario], function(err, resultados){
        if(err){
            console.log("Error al realizar el select", err);
            return res.status(500).json("Error al realizar la consulta");
        }

        if(resultados.length == 0){
            return res.status(403).json({ error: "No existe este usuario." });
        }

        if(resultados[0].password !== password){
            return res.status(403).json({ error: "Credenciales invalidas" });
        }

        var contenido = {
            usuario: resultados[0].id,
            expira: Date.now() + 60 * 60 * 1000   // 1 hora
        };
        var token = jwt.encode(contenido, clave);
        res.status(200).json({ token: token, usuario: resultados[0].id });
    });
});

app.put("/api/gestores/:id", function(req, res){
    var id_gestor = req.params.id;

    var sql = "UPDATE gestores SET nombre = ?, apellidos = ?, usuario = ?, password = ? WHERE id = ?";
    var params = [req.body.nombre, req.body.apellidos, req.body.usuario, req.body.password, id_gestor];

    conexion.query(sql, params, function(err, resultado){
        if(err){
            if(err.code === "ER_DUP_ENTRY"){
                return res.status(400).json({ error: "Usuario ya existe" });
            }
            console.log("Error al actualizar el gestor", err);
            return res.status(500).json("Error al realizar la consulta");
        }

        if(resultado.affectedRows == 0){
            return res.status(404).json("No se ha actualizado la informacion.");
        }

        res.status(201).json("Se han actualizado los datos.");
    });
});