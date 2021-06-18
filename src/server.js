import express from "express";
import cors from "cors";
import pg from "pg";
import Joi from "joi";
import { format, differenceInDays} from 'date-fns'

const server = express();

server.use(cors());
server.use(express.json());

const { Pool } = pg;

const connection = new Pool({
    user: "bootcamp_role",
    password: "senha_super_hiper_ultra_secreta_do_role_do_bootcamp",
    host: "localhost",
    port: 5432,
    database: "boardcamp",
});

server.get('/categories', async (req,res)=>{
    try{
        const result = await connection.query('SELECT * FROM categories');
        res.send(result.rows);
    } catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
});

server.post('/categories', async (req,res)=>{
    const { name } = req.body;
    const schema = Joi.object({
        name: Joi.string().min(1).required().pattern(/[a-zA-Z]/)
    });
    const value = schema.validate({name: name});
    if(value.error) return res.status(400).send("Este nome não é válido.");
    const checkCategory = await connection.query('SELECT * FROM categories where name = $1', [name]);
    if(checkCategory.rows.length !==0 ) return res.sendStatus(409);
    try{
        await connection.query('INSERT INTO categories (name) VALUES ($1)', [name]);
        res.sendStatus(201);
    } catch(e){
        console.log(e);
        res.sendStatus(500);
    }
});

server.get('/games', async (req,res)=>{
    const { name } = req.query;
    try{
        if(!name){
            const result = await connection.query(`
            SELECT games.*, categories.name AS "categoryName"
            FROM games JOIN categories
            ON games."categoryId" = categories.id`);
            res.send(result.rows);
            return;
        }
        const result = await connection.query(`
        SELECT games.*, categories.name AS "categoryName"
        FROM games JOIN categories
        ON games."categoryId" = categories.id
        WHERE games.name ILIKE $1`, [name+"%"]);
        res.send(result.rows);
    } catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
});

server.post('/games', async (req,res)=>{
    const { name, image, stockTotal, categoryId, pricePerDay } = req.body
    const schema = Joi.object({
        name: Joi.string().min(1).pattern(/[a-zA-Z]/).required(),
        stockTotal: Joi.number().min(1).required(),
        categoryId: Joi.number().min(1).required(),
        pricePerDay: Joi.number().min(1).required()
    });
    const value = schema.validate({
        name, 
        stockTotal,
        categoryId,
        pricePerDay,
    });
    if(value.error) return res.sendStatus(400);
    const checkGameName = await connection.query('SELECT name FROM games WHERE name = $1',[name]);
    if(checkGameName.rows.length !== 0) return res.sendStatus(409);
    const checkCategory = await connection.query('SELECT name FROM categories WHERE id = $1',[categoryId]);
    if(checkCategory.rows.length === 0) return res.sendStatus(400);
    try{
        await connection.query(`
        INSERT INTO games (name, image, "stockTotal", "categoryId", "pricePerDay") VALUES ($1, $2, $3, $4, $5)`, 
        [name, image, stockTotal, categoryId, pricePerDay]);
        res.sendStatus(201);
    } catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
});

server.get('/customers', async (req,res)=>{
    const { cpf } = req.query;
    const schema = Joi.object({
        cpf: Joi.number().max(11)
    });
    const value = schema.validate({cpf: cpf});
    if(value.error) return res.status(400).send("Este cpf não é válido");
    try{
        if(!cpf){
            const result = await connection.query(`SELECT * from customers`);
            res.send(result.rows);
        }
        const result = await connection.query(`SELECT * FROM customers WHERE cpf LIKE $1`, [cpf+"%"]);
        res.send(result.rows);
    } catch(e) {
        console.log(e);
        res.sendStatus(500);
    }
});

server.get('/customers/:id', async (req,res)=>{
    const { id } = req.params;
    const schema = Joi.object({
        id: Joi.number()
    });
    const value = schema.validate({id: id});
    if(value.error) return res.sendStatus(400);
    try{
        const result = await connection.query('SELECT * FROM customers WHERE id = $1',[id]);
        if(!result.rows[0]){
            res.sendStatus(404);
            return;
        }
        res.send(result.rows[0]);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }
});

server.post('/customers', async (req,res)=>{
    const { name, phone, cpf, birthday } = req.body;
    const schema = Joi.object({
        name: Joi.string().min(1).pattern(/[a-zA-Z]/).required(),
        phone: Joi.string().required().pattern(/[0-9]{10,11}/),
        cpf: Joi.string().required().pattern(/[0-9]{11}/),
        birthday: Joi.date().less('now').required()
    });
    const value = schema.validate({
        name,
        phone,
        cpf,
        birthday,
    })
    if(value.error) return res.sendStatus(400);
    const checkCpf = await connection.query('SELECT cpf FROM customers WHERE cpf = $1', [cpf]);
    if(checkCpf.rows.length !== 0) return res.sendStatus(409);
    try{
        await connection.query('INSERT INTO customers (name, phone, cpf, birthday) VALUES ($1, $2, $3, $4)', [name, phone, cpf, birthday]);
        res.sendStatus(201);
    }catch(e){
        console.log(e);
        res.sendStatus(500);
    }
});

server.put('/customers/:id', async (req,res)=>{
    const { name, phone, cpf, birthday } = req.body;
    const { id } = req.params;
    const schema = Joi.object({
        name: Joi.string().min(1).pattern(/[a-zA-Z]/).required(),
        phone: Joi.string().required().pattern(/[0-9]{10,11}/),
        cpf: Joi.string().required().pattern(/[0-9]{11}/),
        birthday: Joi.date().less('now').required()
    });
    const value = schema.validate({
        name,
        phone,
        cpf,
        birthday,
    });
    if(value.error) return res.sendStatus(400);
    const cpfOnDataBase = await connection.query(`SELECT cpf FROM customers WHERE id = $1`, [id]);
    if(cpfOnDataBase.rows[0].cpf === cpf){
        try{
        await connection.query('UPDATE customers SET name=$1, phone=$2, cpf=$3, birthday=$4 WHERE id = $5', [name, phone, cpf, birthday, id]);
        res.sendStatus(200);
        } catch(e){
        console.log(e);
        res.sendStatus(500);
        }
    } else {
        return res.sendStatus(409);
    }
});

server.post('/rentals', async (req,res)=>{
    const { customerId, gameId, daysRented } = req.body;
    const schema = Joi.object({
        customerId: Joi.number().required(),
        gameId: Joi.number().required(),
        daysRented: Joi.number().min(1).required(),
    });
    const value = schema.validate({
        customerId,
        gameId,
        daysRented,
    });
    if(value.error) return res.sendStatus(400);

    try{
        const checkClient = await connection.query('SELECT id FROM customers WHERE id = $1', [customerId]);
        if(checkClient.rows.length === 0) return res.sendStatus(400);
        const checkGame = await connection.query('SELECT * FROM games WHERE id = $1', [gameId]);
        if(checkGame.rows[0].id === 0 || checkGame.rows[0].stockTotal < 1) return res.sendStatus(400);
        let originalPrice = daysRented * checkGame.rows[0].pricePerDay;
        const rentDate = format(new Date(), 'yyyy-MM-dd');
        let returnDate = null;
        let delayFee = null;
        await connection.query(`
        INSERT INTO rentals
        ("customerId", "gameId", "rentDate", "daysRented", "returnDate", "originalPrice", "delayFee") 
        VALUES
        ($1, $2, $3, $4, $5, $6, $7)
        `, [customerId, gameId, rentDate, daysRented, returnDate, originalPrice, delayFee]);
        res.sendStatus(201);
    } catch(e){
        console.log(e);
        res.sendStatus(500);       
    }
});


server.get('/rentals', async (req,res)=>{
    const { costumerId } = req.params;
    const { gameId } = req.params;
    try{
        if(costumerId){
            const result = await connection.query(`
            SELECT rentals.*, 
            jsonb_build_object('name', customers.name, 'id', customers.id) AS customer,
            jsonb_build_object('id', games.id, 'name', games.name, 'categoryId', games."categoryId", 'categoryName', categories.name) AS game            
            FROM rentals 
            JOIN customers ON rentals."customerId" = customers.id
            JOIN games ON rentals."gameId" = games.id
            JOIN categories ON categories.id = games."categoryId"
            WHERE customers.id = $1
            `, [costumerId]);
            res.send(result.rows);
        } else if(gameId){
            const result = await connection.query(`
            SELECT rentals.*, 
            jsonb_build_object('name', customers.name, 'id', customers.id) AS customer,
            jsonb_build_object('id', games.id, 'name', games.name, 'categoryId', games."categoryId", 'categoryName', categories.name) AS game            
            FROM rentals 
            JOIN customers ON rentals."customerId" = customers.id
            JOIN games ON rentals."gameId" = games.id
            JOIN categories ON categories.id = games."categoryId"
            WHERE games.id = $1
            `[gameId]);
            res.send(result.rows);
        } else {
            const result = await connection.query(`
            SELECT rentals.*, 
            jsonb_build_object('name', customers.name, 'id', customers.id) AS customer,
            jsonb_build_object('id', games.id, 'name', games.name, 'categoryId', games."categoryId", 'categoryName', categories.name) AS game            
            FROM rentals 
            JOIN customers ON rentals."customerId" = customers.id
            JOIN games ON rentals."gameId" = games.id
            JOIN categories ON categories.id = games."categoryId"
            `);
            res.send(result.rows);
        }
    } catch (e){
        console.log(e);
        res.sendStatus(500);
    }
});

server.post('/rentals/:id/return', async (req,res)=>{
    const { id } = req.params;
    const today = format(new Date(), 'yyyy-MM-dd');
    const checkFee = await connection.query(`SELECT * FROM rentals WHERE id = $1 `, [id]);
    if(!checkFee) return res.sendStatus(404);
    if(checkFee.rows[0].returnDate) return res.sendStatus(400);
    const diferenceResult = differenceInDays(new Date(checkFee.rows[0].rentDate), new Date(today))
    const delayFee = diferenceResult > checkFee.rows[0].daysRented ? (diferenceResult - checkFee.rows[0].daysRented) * (checkFee.rows[0].originalPrice/checkFee.rows[0].daysRented) : "0";
    await connection.query('UPDATE rentals SET "returnDate" = $1, "delayFee" = $2 WHERE id = $3',[today,delayFee,id]); 
    res.sendStatus(200);
});

server.delete("/rentals/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const checkDeletion = await connection.query('SELECT * FROM rentals WHERE id = $1', [id]);
        if (checkDeletion.rows.length === 0) {
            res.sendStatus(404)
            return;
        }
        else if (checkDeletion.rows[0].returnDate) {
            res.sendStatus(400)
            return;
        }
        await connection.query('DELETE FROM rentals WHERE id = $1', [id]);
        res.sendStatus(200);
    } catch {
        res.sendStatus(500)
    };
});

server.listen(4000, ()=>{
    console.log("Server running on port 4000");
});