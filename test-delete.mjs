import axios from 'axios';

const testDelete = async () => {
  console.log('Testing DELETE operation (will 404 as expected)...\n');
  
  try {
    const response = await axios.delete('http://localhost:5000/api/per_trn_identify_risk/999999');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Error caught (this is expected for non-existent records):');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.message);
  }
};

testDelete();
