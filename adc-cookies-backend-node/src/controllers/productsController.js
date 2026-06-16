import * as productsService from '../services/productsService.js';

export async function getProducts(req, res) {
  const { category, search } = req.query;
  res.json(await productsService.getProducts(category, search));
}

export async function getProduct(req, res) {
  res.json(await productsService.getProductById(req.params.id));
}
